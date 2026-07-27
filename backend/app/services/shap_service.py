"""
app/services/shap_service.py — Explicabilité SHAP pour l'API
Compatible avec le pipeline ImbPipeline (FE + preprocessor + model).
"""

import json
import joblib
import logging
import numpy as np
from pathlib import Path
from app.config.settings import settings
from app.services.model_service import pipeline, employe_to_dataframe
from app.schemas.employe import EmployeData

logger = logging.getLogger(__name__)

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    logger.warning("shap non installé — /explain indisponible")


def _get_clf_and_preprocessor():
    """Extrait le classifieur et le preprocesseur du pipeline."""
    if pipeline is None or not hasattr(pipeline, "named_steps"):
        raise RuntimeError("Pipeline non chargé")
    clf          = pipeline.named_steps.get("model")
    fe_step      = pipeline.named_steps.get("feature_engineer")
    preprocessor = pipeline.named_steps.get("preprocessor")
    if clf is None:
        raise RuntimeError("Aucun modèle dans le pipeline")
    return clf, fe_step, preprocessor


def explain(data: EmployeData) -> dict:
    """
    Calcule les contributions SHAP pour un employé.
    Retourne les 10 features les plus influentes.
    """
    if not SHAP_AVAILABLE:
        return {"error": "SHAP non disponible", "contributions": []}

    if pipeline is None:
        return {"error": "Modèle non chargé", "contributions": []}

    try:
        clf, fe_step, preprocessor = _get_clf_and_preprocessor()

        # Préparer l'input
        df = employe_to_dataframe(data)

        # Appliquer FE + preprocessing (comme le pipeline le ferait)
        if fe_step is not None:
            df_fe = fe_step.transform(df)
        else:
            df_fe = df

        if preprocessor is not None:
            X_transformed = preprocessor.transform(df_fe)
            feature_names = list(preprocessor.get_feature_names_out())
        else:
            X_transformed = df_fe.values
            feature_names = list(df_fe.columns)

        model_type = "rf" if "RandomForest" in type(clf).__name__ else "logreg"

        # Explainer selon le type
        if model_type == "rf":
            explainer   = shap.TreeExplainer(clf)
            shap_values = explainer.shap_values(X_transformed)
            if isinstance(shap_values, list):
                values = shap_values[1][0]
            else:
                values = shap_values[0]
        else:
            # Pour LogisticRegression : LinearExplainer avec données de référence
            ref_path = Path(settings.ML_ARTIFACTS_DIR) / "splits" / "test_data.joblib"
            if ref_path.exists():
                X_ref, _ = joblib.load(ref_path)
                if fe_step:
                    X_ref = fe_step.transform(X_ref)
                if preprocessor:
                    X_ref = preprocessor.transform(X_ref)
                background = shap.sample(X_ref, min(100, len(X_ref)))
            else:
                background = X_transformed  # fallback

            explainer   = shap.LinearExplainer(clf, background)
            shap_values = explainer.shap_values(X_transformed)
            if hasattr(shap_values, "shape") and len(shap_values.shape) == 3:
                values = shap_values[0, :, 1]
            else:
                values = shap_values[0]

        # Trier par importance absolue
        contributions = sorted(
            [
                {
                    "feature":     feat,
                    "shap_value":  round(float(v), 4),
                    "direction":   "augmente" if v > 0 else "diminue",
                    "abs_impact":  round(abs(float(v)), 4),
                }
                for feat, v in zip(feature_names, values)
            ],
            key=lambda x: x["abs_impact"],
            reverse=True,
        )

        # Proba de prédiction
        proba = float(pipeline.predict_proba(employe_to_dataframe(data))[0][1])

        return {
            "probabilite":    round(proba, 4),
            "model_type":     model_type,
            "contributions":  contributions[:10],
            "n_features":     len(feature_names),
        }

    except Exception as e:
        logger.exception("Erreur SHAP explain")
        return {"error": str(e), "contributions": []}


def get_global_insights() -> dict:
    """Retourne les insights SHAP globaux (pré-calculés par ml/explain.py)."""
    path = Path(settings.SHAP_INSIGHTS_PATH)
    if not path.exists():
        return {"error": "Insights SHAP non disponibles. Lancez ml/explain.py d'abord.", "top_drivers": []}
    try:
        return json.loads(path.read_text())
    except Exception as e:
        return {"error": str(e), "top_drivers": []}