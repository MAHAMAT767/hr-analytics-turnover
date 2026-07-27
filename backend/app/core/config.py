"""
app/core/config.py — Configuration centralisée avec Pydantic Settings
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional, List
from pathlib import Path

class Settings(BaseSettings):
    # API
    APP_NAME: str = "HR Analytics API"
    APP_VERSION: str = "2.1.0"
    DEBUG: bool = False
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    # Chemins
    BASE_DIR: Path = Path(__file__).parent.parent.parent
    MODEL_REGISTRY_DIR: Path = BASE_DIR / "model_registry"
    LOGS_DIR: Path = BASE_DIR / "logs"
    MLFLOW_TRACKING_URI: str = str(BASE_DIR / "mlruns")
    MLFLOW_EXPERIMENT_NAME: str = "hr_turnover_prediction"
    
    # Modèle
    DEFAULT_THRESHOLD: float = 0.40
    MODEL_PATH: str = "ml/artifacts/model.pkl"
    METADATA_PATH: str = "ml/artifacts/metadata.json"
    
    # Monitoring
    MONITORING_ENABLED: bool = True
    DRIFT_ALERT_THRESHOLD: float = 0.25
    
    # HuggingFace
    HF_TOKEN: Optional[str] = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"
    
    def get_absolute_path(self, path: str) -> Path:
        return self.BASE_DIR / path

settings = Settings()
settings.LOGS_DIR.mkdir(parents=True, exist_ok=True)
settings.MODEL_REGISTRY_DIR.mkdir(parents=True, exist_ok=True)