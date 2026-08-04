"""
app/services/model_service.py — Service de prédiction
"""

import json
import joblib
import logging
import pandas as pd
import numpy as np
import sys
from datetime import datetime
from pathlib import Path
from app.config.settings import settings
from app.schemas.employe import EmployeData

logger = logging.getLogger(__name__)

# ml/ doit être sur le sys.path pour pouvoir importer build_features
backend_path = Path(__file__).parent.parent.parent
ml_path = backend_path / "ml"
sys.path.insert(0, str(ml_path))

# build_features doit être définie dans ce module ET injectée dans
# sys.modules["__main__"] avant joblib.load(). Le pipeline a été sérialisé avec
# build_features appartenant à __main__ (train.py lancé comme script), donc pickle
# la cherche dans __main__ à la désérialisation.
def build_features(X: pd.DataFrame) -> pd.DataFrame:
    X = X.copy()
    X["SalaryPerYear"]    = X["MonthlyIncome"] / (X["YearsAtCompany"] + 1)
    X["CareerStability"]  = X["YearsAtCompany"] / (X["TotalWorkingYears"] + 1e-6)
    X["PromotionGap"]     = X["YearsSinceLastPromotion"] / (X["YearsAtCompany"] + 1)
    X["OvertimeRisk"]     = ((X["OverTime"] == "Yes") & (X["WorkLifeBalance"] <= 2)).astype(int)
    X["WorkloadIndex"]    = X["OverTime"].map({"Yes": 1, "No": 0}) + (6 - X["WorkLifeBalance"])
    X["SatRisk"]          = (X["JobSatisfaction"] <= 2).astype(int)
    X = X.replace([np.inf, -np.inf], 0).fillna(0)
    return X

# Injection dans __main__ — requis par pickle pour la désérialisation
sys.modules["__main__"].build_features = build_features
logger.info("✓ build_features injectée dans __main__ pour désérialisation pickle")

# ── Chargement du pipeline ────────────────────────────────────────────────────
pipeline   = None
THRESHOLD  = settings.DEFAULT_THRESHOLD
MODEL_NAME = "unknown"
metadata   = {}

try:
    model_path = Path(settings.MODEL_PATH)
    if model_path.exists():
        logger.info(f"Chargement du modèle depuis {model_path}...")
        pipeline = joblib.load(model_path)
        logger.info("✓ Modèle chargé avec succès")

        meta_path = Path(settings.METADATA_PATH)
        if meta_path.exists():
            metadata   = json.loads(meta_path.read_text())
            THRESHOLD  = float(metadata.get("threshold", settings.DEFAULT_THRESHOLD))
            MODEL_NAME = metadata.get("model_name", "unknown")
            logger.info(f"✓ Métadonnées chargées: {MODEL_NAME} | seuil={THRESHOLD}")
        else:
            logger.warning(f"⚠ Métadonnées introuvables: {meta_path}")
    else:
        logger.warning(f"⚠ Modèle introuvable: {model_path}")
except Exception as e:
    logger.error(f"✗ Erreur chargement modèle: {e}")
    logger.exception(e)


# ── Conversion EmployeData → DataFrame brut ───────────────────────────────────
def employe_to_dataframe(data: EmployeData) -> pd.DataFrame:
    # Gender doit être une string : l'OneHotEncoder a été entraîné sur 'Male'/'Female'
    overtime_str = "Yes" if data.OverTime == 1 else "No"
    gender_str   = "Male" if data.Gender == 1 else "Female"

    row = {
        "Age":                      data.Age,
        "DailyRate":                data.DailyRate,
        "DistanceFromHome":         data.DistanceFromHome,
        "Education":                data.Education,
        "EnvironmentSatisfaction":  data.EnvironmentSatisfaction,
        "Gender":                   gender_str,
        "HourlyRate":               data.HourlyRate,
        "JobInvolvement":           data.JobInvolvement,
        "JobLevel":                 data.JobLevel,
        "JobSatisfaction":          data.JobSatisfaction,
        "MonthlyIncome":            data.MonthlyIncome,
        "MonthlyRate":              data.MonthlyRate,
        "NumCompaniesWorked":       data.NumCompaniesWorked,
        "PercentSalaryHike":        data.PercentSalaryHike,
        "PerformanceRating":        data.PerformanceRating,
        "RelationshipSatisfaction": data.RelationshipSatisfaction,
        "StockOptionLevel":         data.StockOptionLevel,
        "TotalWorkingYears":        data.TotalWorkingYears,
        "TrainingTimesLastYear":    data.TrainingTimesLastYear,
        "WorkLifeBalance":          data.WorkLifeBalance,
        "YearsAtCompany":           data.YearsAtCompany,
        "YearsInCurrentRole":       data.YearsInCurrentRole,
        "YearsSinceLastPromotion":  data.YearsSinceLastPromotion,
        "YearsWithCurrManager":     data.YearsWithCurrManager,
        "BusinessTravel":           data.BusinessTravel,
        "Department":               data.Department,
        "EducationField":           data.EducationField,
        "Gender_str":               gender_str,
        "JobRole":                  data.JobRole,
        "MaritalStatus":            data.MaritalStatus,
        "OverTime":                 overtime_str,
    }
    return pd.DataFrame([row])


# ── Prédiction ────────────────────────────────────────────────────────────────
def predict(data: EmployeData) -> dict:
    if pipeline is None:
        return {
            "probabilite":   0.5,
            "niveau_risque": "inconnu",
            "pourcentage":   "50.0%",
            "erreur":        "Modèle non chargé — lancez ml/train.py d'abord",
        }

    try:
        df    = employe_to_dataframe(data)
        proba = float(pipeline.predict_proba(df)[0][1])

        if proba < 0.25:
            niveau  = "faible"
            couleur = "green"
        elif proba < 0.45:
            niveau  = "moyen"
            couleur = "orange"
        else:
            # Le frontend attend "élevé" avec l'accent — ne pas normaliser
            niveau  = "élevé"
            couleur = "red"

        result = {
            "probabilite":        round(proba, 4),
            "niveau_risque":      niveau,
            "couleur_risque":     couleur,
            "pourcentage":        f"{proba * 100:.1f}%",
            "seuil":              THRESHOLD,
            "prediction":         "Risque de départ" if proba >= THRESHOLD else "Stable",
            "prediction_binaire": int(proba >= THRESHOLD),
            "modele":             MODEL_NAME,
            "version":            metadata.get("version", "?"),
        }

        try:
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "input":     data.dict(),
                "output":    result,
            }
            log_path = Path(settings.LOG_PATH)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.warning(f"Erreur lors de l'écriture du log: {e}")

        return result

    except Exception as e:
        logger.exception("Erreur lors de la prédiction")
        return {
            "probabilite":   0.5,
            "niveau_risque": "erreur",
            "pourcentage":   "50.0%",
            "erreur":        str(e),
        }


# ── Feature importance ────────────────────────────────────────────────────────
def feature_importance() -> dict:
    """
    Importance des features du modèle courant.

    Le champ "source" indique la méthode employée :
    "feature_importances" (RandomForest) ou "coefficients" (LogisticRegression).
    """
    if pipeline is None:
        return {"features": [], "message": "Modèle non chargé"}

    try:
        if not hasattr(pipeline, "named_steps"):
            return {"features": [], "message": "Pipeline sans named_steps"}

        clf          = pipeline.named_steps.get("model")
        preprocessor = pipeline.named_steps.get("preprocessor")

        if clf is None:
            return {"features": [], "message": "Aucun modèle dans le pipeline"}

        # Noms des features
        if preprocessor is not None:
            feature_names = preprocessor.get_feature_names_out()
        else:
            feature_names = [f"feature_{i}" for i in range(10)]

        # RandomForest → feature_importances_
        if hasattr(clf, "feature_importances_"):
            source      = "feature_importances"
            importances = pd.Series(
                clf.feature_importances_, index=feature_names
            ).nlargest(15).round(4)

        # LogisticRegression → coef_ (valeur absolue normalisée)
        elif hasattr(clf, "coef_"):
            source = "coefficients"
            coefs  = np.abs(clf.coef_[0])
            total  = coefs.sum() or 1
            importances = pd.Series(
                coefs / total, index=feature_names
            ).nlargest(15).round(4)

        else:
            return {"features": [], "message": "Feature importance non supportée pour ce modèle"}

        return {
            "model":    MODEL_NAME,
            "source":   source,
            "features": [
                {"feature": str(k), "importance": float(v)}
                for k, v in importances.items()
            ],
        }

    except Exception as e:
        logger.exception("Erreur feature importance")
        return {"features": [], "message": str(e)}


# ── Métriques du modèle courant ───────────────────────────────────────────────
def get_model_metrics() -> dict:
    eval_path = Path(settings.get_absolute_path("ml/artifacts/eval_metrics.json"))

    result = {
        "model_name": MODEL_NAME,
        "version":    metadata.get("version", "?"),
        "threshold":  THRESHOLD,
        "mlflow_run_id": metadata.get("mlflow_run_id"),
    }

    if eval_path.exists():
        eval_data = json.loads(eval_path.read_text())
        result.update(eval_data.get("technical_metrics", {}))
        result["business_metrics"] = eval_data.get("business_metrics", {})
    elif "test_metrics" in metadata:
        result.update(metadata["test_metrics"])

    return result