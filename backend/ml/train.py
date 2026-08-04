"""
ml/train.py — Pipeline d'entraînement avec MLflow Tracking
"""

import json
import warnings
import logging
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path

import mlflow
import mlflow.sklearn
from mlflow.models.signature import infer_signature

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_validate
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.dummy import DummyClassifier
from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score,
    recall_score, confusion_matrix, precision_recall_curve
)
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.over_sampling import SMOTE
import joblib

warnings.filterwarnings("ignore")

# ─── MLflow (backend SQLite) ────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
MLRUNS_DIR = BASE_DIR / "mlruns"
DB_PATH = BASE_DIR / "mlflow.db"

MLRUNS_DIR.mkdir(parents=True, exist_ok=True)

TRACKING_URI = f"sqlite:///{DB_PATH.absolute()}"
mlflow.set_tracking_uri(TRACKING_URI)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ─── Chemins ────────────────────────────────────────────────────────────────
ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
MODELS_DIR = ARTIFACTS_DIR / "models"
SPLITS_DIR = ARTIFACTS_DIR / "splits"

for d in [ARTIFACTS_DIR, MODELS_DIR, SPLITS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# ─── Config ─────────────────────────────────────────────────────────────────
RANDOM_STATE = 42
TEST_SIZE = 0.2
TARGET_RECALL = 0.70
COST_PER_TURNOVER = 15_000
COST_INTERVENTION = 350
EXPERIMENT_NAME = "hr_turnover_prediction"

np.random.seed(RANDOM_STATE)


# ─── Feature Engineering ────────────────────────────────────────────────────
def build_features(X: pd.DataFrame) -> pd.DataFrame:
    X = X.copy()
    X["SalaryPerYear"] = X["MonthlyIncome"] / (X["YearsAtCompany"] + 1)
    X["CareerStability"] = X["YearsAtCompany"] / (X["TotalWorkingYears"] + 1e-6)
    X["PromotionGap"] = X["YearsSinceLastPromotion"] / (X["YearsAtCompany"] + 1)
    X["OvertimeRisk"] = ((X["OverTime"] == "Yes") & (X["WorkLifeBalance"] <= 2)).astype(int)
    X["WorkloadIndex"] = X["OverTime"].map({"Yes": 1, "No": 0}) + (6 - X["WorkLifeBalance"])
    X["SatRisk"] = (X["JobSatisfaction"] <= 2).astype(int)
    X = X.replace([np.inf, -np.inf], 0).fillna(0)
    return X


# ─── Chargement ─────────────────────────────────────────────────────────────
def load_data() -> tuple:
    path = BASE_DIR / "data" / "WA_Fn-UseC_-HR-Employee-Attrition.csv"
    if not path.exists():
        raise FileNotFoundError(f"Dataset introuvable: {path}")
    df = pd.read_csv(path)
    df["Attrition"] = df["Attrition"].map({"Yes": 1, "No": 0})
    df.drop(columns=["EmployeeNumber", "EmployeeCount", "Over18", "StandardHours"], inplace=True)
    X = df.drop("Attrition", axis=1)
    y = df["Attrition"]
    logger.info(f"Dataset: {X.shape[0]} lignes, {X.shape[1]} colonnes | Taux attrition: {y.mean():.1%}")
    return X, y


# ─── Pipeline factory ───────────────────────────────────────────────────────
def make_pipeline(X_sample: pd.DataFrame, model) -> ImbPipeline:
    X_fe = build_features(X_sample)
    num_cols = X_fe.select_dtypes(include=["int64", "float64"]).columns.tolist()
    cat_cols = X_fe.select_dtypes(include=["object"]).columns.tolist()

    preprocessor = ColumnTransformer([
        ("num", StandardScaler(), num_cols),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols),
    ])

    from sklearn.preprocessing import FunctionTransformer
    fe_step = FunctionTransformer(build_features, validate=False)

    return ImbPipeline([
        ("feature_engineer", fe_step),
        ("preprocessor", preprocessor),
        ("smote", SMOTE(random_state=RANDOM_STATE)),
        ("model", model),
    ])


# ─── Optimisation du seuil ──────────────────────────────────────────────────
def optimize_threshold(y_true, y_proba, target_recall: float = TARGET_RECALL) -> float:
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_proba)
    valid = recalls[:-1] >= target_recall
    if np.any(valid):
        f1s = 2 * (precisions[:-1][valid] * recalls[:-1][valid]) / (
            precisions[:-1][valid] + recalls[:-1][valid] + 1e-9
        )
        return float(thresholds[valid][np.argmax(f1s)])
    logger.warning(f"Aucun seuil avec recall >= {target_recall}, fallback 0.35")
    return 0.35


# ─── Pipeline principal ─────────────────────────────────────────────
def train(run_name: str = None):
    """Pipeline d'entraînement avec MLflow tracking."""
    with mlflow.start_run(run_name=run_name or f"train_{datetime.now().strftime('%Y%m%d_%H%M%S')}") as run:
        run_id = run.info.run_id
        logger.info(f"MLflow run_id: {run_id}")

        mlflow.set_tag("mlflow.experiment", EXPERIMENT_NAME)
        mlflow.set_tag("model_type", "turnover_prediction")
        
        # ── Log des paramètres ────────────────────────────────────────────
        mlflow.log_params({
            "random_state": RANDOM_STATE,
            "test_size": TEST_SIZE,
            "target_recall": TARGET_RECALL,
            "cost_turnover": COST_PER_TURNOVER,
            "cost_intervention": COST_INTERVENTION,
        })

        # 1. Chargement & split
        X, y = load_data()
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
        )
        joblib.dump((X_test, y_test), SPLITS_DIR / "test_data.joblib")
        mlflow.log_params({"train_size": len(X_train), "test_size_n": len(X_test)})

        # 2. Baseline
        dummy = DummyClassifier(strategy="stratified", random_state=RANDOM_STATE)
        dummy.fit(X_train, y_train)
        baseline_auc = roc_auc_score(y_test, dummy.predict_proba(X_test)[:, 1])
        mlflow.log_metric("baseline_roc_auc", round(baseline_auc, 4))
        logger.info(f"Baseline ROC-AUC: {baseline_auc:.4f}")

        # 3. Cross-validation
        candidates = {
            "logreg": LogisticRegression(
                max_iter=1000, random_state=RANDOM_STATE, class_weight="balanced"
            ),
            "rf": RandomForestClassifier(
                n_estimators=200, max_depth=8,
                random_state=RANDOM_STATE, class_weight="balanced", n_jobs=-1
            ),
        }

        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
        cv_results = {}
        for name, clf in candidates.items():
            pipe = make_pipeline(X_train.iloc[:1], clf)
            scores = cross_validate(pipe, X_train, y_train, cv=cv, scoring="roc_auc", n_jobs=-1)
            mean_auc = float(np.mean(scores["test_score"]))
            cv_results[name] = mean_auc
            mlflow.log_metric(f"cv_roc_auc_{name}", round(mean_auc, 4))
            logger.info(f"  CV {name}: ROC-AUC = {mean_auc:.4f}")

        best_name = max(cv_results, key=cv_results.get)
        best_clf = candidates[best_name]
        logger.info(f"Meilleur modèle : {best_name}")
        mlflow.log_param("best_model", best_name)

        # 4. Entraînement final
        best_pipeline = make_pipeline(X_train.iloc[:1], best_clf)
        best_pipeline.fit(X_train, y_train)

        # 5. Évaluation
        y_proba = best_pipeline.predict_proba(X_test)[:, 1]
        threshold = optimize_threshold(y_test, y_proba)
        y_pred = (y_proba >= threshold).astype(int)

        roc = roc_auc_score(y_test, y_proba)
        f1 = f1_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred)
        rec = recall_score(y_test, y_pred)
        cm = confusion_matrix(y_test, y_pred)
        tn, fp, fn, tp = cm.ravel()

        # Business metrics
        intervention_cost = (tp + fp) * COST_INTERVENTION
        savings = max(0, tp * COST_PER_TURNOVER - intervention_cost)

        mlflow.log_metrics({
            "roc_auc": round(roc, 4),
            "f1": round(f1, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "threshold": round(threshold, 4),
            "true_positives": int(tp),
            "false_positives": int(fp),
            "true_negatives": int(tn),
            "false_negatives": int(fn),
            "estimated_savings": round(savings, 2),
            "intervention_cost": round(float(intervention_cost), 2),
        })

        logger.info(f"ROC-AUC={roc:.4f} | F1={f1:.4f} | Recall={rec:.4f} | Savings={savings:,.0f}€")

        # 6. Versioning & sauvegarde
        version = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_dir = MODELS_DIR / version
        model_dir.mkdir(exist_ok=True)

        model_path = model_dir / "model.pkl"
        joblib.dump(best_pipeline, model_path)

        # Sauvegarde dans artifacts/
        joblib.dump(best_pipeline, ARTIFACTS_DIR / "model.pkl")

        metadata = {
            "model_name": best_name,
            "threshold": float(threshold),
            "version": version,
            "mlflow_run_id": run_id,
            "trained_at": datetime.now().isoformat(),
            "test_metrics": {
                "roc_auc": float(roc),
                "f1": float(f1),
                "recall": float(rec),
                "precision": float(prec),
                "confusion_matrix": cm.tolist(),
                "savings_eur": float(savings),
            },
            "baseline_roc_auc": float(baseline_auc),
            "cv_results": cv_results,
        }
        with open(model_dir / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)
        with open(ARTIFACTS_DIR / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)

        # Écrire la version courante
        with open(MODELS_DIR / "current_version.txt", "w") as f:
            f.write(version)

        # Le modèle est loggé sans registered_model_name : le model registry
        # n'est pas supporté par le backend SQLite utilisé ici.
        signature = infer_signature(X_train.head(5), best_pipeline.predict_proba(X_train.head(5)))
        mlflow.sklearn.log_model(
            sk_model=best_pipeline,
            artifact_path="model",
            signature=signature,
        )
        mlflow.log_text(f"Model: {best_name}\nVersion: {version}", "model_info.txt")


        mlflow.log_artifact(str(model_dir / "metadata.json"), artifact_path="metadata")
        mlflow.log_artifact(str(SPLITS_DIR / "test_data.joblib"), artifact_path="splits")

        # ── Rapport console ───────────────────────────────────────────────
        print("\n" + "=" * 60)
        print("RÉSULTATS D'ENTRAÎNEMENT")
        print("=" * 60)
        print(f"  Modèle   : {best_name} (v{version})")
        print(f"  Seuil    : {threshold:.3f}")
        print(f"  ROC-AUC  : {roc:.4f}")
        print(f"  F1       : {f1:.4f}")
        print(f"  Recall   : {rec:.4f}")
        print(f"  Precision: {prec:.4f}")
        print(f"  TP={tp} TN={tn} FP={fp} FN={fn}")
        print(f"  Économies estimées : {savings:,.0f} €")
        print(f"  MLflow run_id      : {run_id}")
        print(f"  MLflow tracking URI: {mlflow.get_tracking_uri()}")
        print("=" * 60)
        print("\n Pour visualiser les runs:")
        print(f"   mlflow ui --backend-store-uri {DB_PATH}")
        print(f"   Ou: mlflow ui --sqlite {DB_PATH}")
        print(f"   Puis ouvrir http://localhost:5000\n")

        return metadata


if __name__ == "__main__":
    train()