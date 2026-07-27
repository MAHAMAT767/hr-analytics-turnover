import logging
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict
from .config import settings

class JSONFormatter(logging.Formatter):
    """Formatteur JSON pour logs structurés"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Ajouter les exceptions si présentes
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        # Ajouter les extra fields
        if hasattr(record, "extra_data"):
            log_entry["extra"] = record.extra_data
        
        return json.dumps(log_entry, ensure_ascii=False)

def setup_logging():
    """Configure le logging structuré"""
    # Logger JSON pour les logs applicatifs
    json_handler = logging.FileHandler(settings.LOGS_DIR / "app.log")
    json_handler.setFormatter(JSONFormatter())
    
    # Logger console pour le debug
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    ))
    
    # Configuration root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO if not settings.DEBUG else logging.DEBUG)
    root_logger.addHandler(json_handler)
    root_logger.addHandler(console_handler)
    
    # Logger spécifique pour les prédictions
    pred_logger = logging.getLogger("predictions")
    pred_handler = logging.FileHandler(settings.LOGS_DIR / "predictions.jsonl")
    pred_handler.setFormatter(JSONFormatter())
    pred_logger.addHandler(pred_handler)
    pred_logger.setLevel(logging.INFO)
    pred_logger.propagate = False
    
    return root_logger

logger = setup_logging()

def log_prediction(request_id: str, input_data: Dict, output: Dict, latency_ms: float):
    """Log structuré d'une prédiction"""
    pred_logger = logging.getLogger("predictions")
    pred_logger.info("Prediction made", extra={
        "extra_data": {
            "request_id": request_id,
            "input": input_data,
            "output": output,
            "latency_ms": latency_ms
        }
    })