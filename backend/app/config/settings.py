"""
app/config/settings.py — Configuration centralisée
"""

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # ── Clés API ──────────────────────────────────────────────────────────
    HF_TOKEN: str = ""

    # ── Chemins ML ────────────────────────────────────────────────────────
    ML_ARTIFACTS_DIR: str = "ml/artifacts"
    MODEL_PATH:       str = "ml/artifacts/model.pkl"
    METADATA_PATH:    str = "ml/artifacts/metadata.json"

    # ── Métriques et données ──────────────────────────────────────────────
    METRICS_PATH:     str = "ml/artifacts/metrics.json"
    EVAL_METRICS_PATH:str = "ml/artifacts/eval_metrics.json"
    DATA_PATH:        str = "data/WA_Fn-UseC_-HR-Employee-Attrition.csv"
    LOG_PATH:         str = "logs/predictions.json"

    # ── SHAP ──────────────────────────────────────────────────────────────
    SHAP_SUMMARY_PATH:  str = "ml/artifacts/shap_summary.png"
    SHAP_INSIGHTS_PATH: str = "ml/artifacts/shap_insights.json"

    # ── MLflow ────────────────────────────────────────────────────────────
    MLFLOW_TRACKING_URI: str = "mlruns"
    MLFLOW_EXPERIMENT:   str = "hr_turnover_prediction"

    # ── Modèle ────────────────────────────────────────────────────────────
    DEFAULT_THRESHOLD: float = 0.40

    class Config:
        env_file = ".env"
        extra    = "ignore"

    def get_absolute_path(self, relative_path: str) -> Path:
        """Résout un chemin relatif depuis la racine du projet backend."""
        base = Path(__file__).parent.parent.parent
        return base / relative_path


settings = Settings()