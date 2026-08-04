"""
ml/evaluate.py — Évaluation avec logging MLflow
"""

import json
import joblib
import logging
import mlflow
from pathlib import Path
from datetime import datetime
from sklearn.metrics import (
    roc_auc_score, f1_score, precision_score,
    recall_score, confusion_matrix
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR      = Path(__file__).parent.parent
ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
MODELS_DIR    = ARTIFACTS_DIR / "models"
SPLITS_DIR    = ARTIFACTS_DIR / "splits"
MLRUNS_DIR    = BASE_DIR / "mlruns"
DB_PATH       = BASE_DIR / "mlflow.db"

COST_PER_TURNOVER = 15_000
COST_INTERVENTION = 350


# build_features doit être importable pour que joblib puisse désérialiser le pipeline
import sys as _sys
_sys.path.insert(0, str(Path(__file__).parent))
from train import build_features  # noqa: F401 — nécessaire pour joblib.load()


def load_latest_model():
    model_path = ARTIFACTS_DIR / "model.pkl"
    if not model_path.exists():
        raise FileNotFoundError("Modèle introuvable. Lancez train.py d'abord.")
    model = joblib.load(model_path)

    metadata_path = ARTIFACTS_DIR / "metadata.json"
    metadata = json.loads(metadata_path.read_text()) if metadata_path.exists() else {"threshold": 0.4}
    version  = metadata.get("version", "unknown")

    logger.info(f"Modèle chargé: {metadata.get('model_name', '?')} v{version}")
    return model, metadata, version


def load_test_data():
    path = SPLITS_DIR / "test_data.joblib"
    if not path.exists():
        raise FileNotFoundError("Données de test introuvables. Lancez train.py d'abord.")
    X_test, y_test = joblib.load(path)
    logger.info(f"Test set: {len(X_test)} échantillons")
    return X_test, y_test


def evaluate():
    logger.info("Démarrage de l'évaluation...")
    mlflow.set_tracking_uri(f"sqlite:///{DB_PATH.absolute()}")

    model, metadata, version = load_latest_model()
    X_test, y_test = load_test_data()
    threshold  = metadata.get("threshold", 0.4)
    model_name = metadata.get("model_name", "unknown")
    run_id     = metadata.get("mlflow_run_id")

    y_proba = model.predict_proba(X_test)[:, 1]
    y_pred  = (y_proba >= threshold).astype(int)

    roc  = roc_auc_score(y_test, y_proba)
    f1   = f1_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred)
    rec  = recall_score(y_test, y_pred)
    cm   = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    intervention_cost = (tp + fp) * COST_INTERVENTION
    savings           = max(0, tp * COST_PER_TURNOVER - intervention_cost)

    metrics = {
        "model_name":       model_name,
        "threshold":        threshold,
        "version":          version,
        "evaluation_date":  datetime.now().isoformat(),
        "technical_metrics": {
            "roc_auc":   float(roc),
            "f1":        float(f1),
            "precision": float(prec),
            "recall":    float(rec),
        },
        "confusion_matrix": {
            "true_negatives":  int(tn),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_positives":  int(tp),
        },
        "business_metrics": {
            "cost_per_turnover": COST_PER_TURNOVER,
            "cost_intervention": COST_INTERVENTION,
            "estimated_savings": float(savings),
            "intervention_cost": float(intervention_cost),
        },
    }

    # On logue dans le run d'entraînement d'origine s'il est connu
    with mlflow.start_run(run_id=run_id) if run_id else mlflow.start_run(run_name=f"eval_{version}") as run:
        mlflow.log_metrics({
            "eval_roc_auc":           round(roc, 4),
            "eval_f1":                round(f1, 4),
            "eval_precision":         round(prec, 4),
            "eval_recall":            round(rec, 4),
            "eval_estimated_savings": round(savings, 2),
        })
        eval_path = ARTIFACTS_DIR / "eval_metrics.json"
        eval_path.write_text(json.dumps(metrics, indent=2))
        mlflow.log_artifact(str(eval_path), artifact_path="evaluation")

    print("\n" + "=" * 60)
    print("ÉVALUATION DU MODÈLE")
    print("=" * 60)
    print(f"  Modèle   : {model_name} (v{version})")
    print(f"  Seuil    : {threshold:.3f}")
    print(f"  ROC-AUC  : {roc:.4f}")
    print(f"  F1       : {f1:.4f}")
    print(f"  Recall   : {rec:.4f}")
    print(f"  Precision: {prec:.4f}")
    print(f"  TP={tp} TN={tn} FP={fp} FN={fn}")
    print(f"  Économies : {savings:,.0f} €")
    print("=" * 60)

    return metrics


if __name__ == "__main__":
    evaluate()