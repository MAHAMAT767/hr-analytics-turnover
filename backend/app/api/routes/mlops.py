from fastapi import APIRouter
from datetime import datetime
from pathlib import Path
import json

from app.services.mlflow_tracker import mlflow_tracker

router = APIRouter(prefix="/api", tags=["5. MLOps"])


@router.get("/model-info")
def model_info():
    """Informations sur le modèle en production"""
    backend_path = Path(__file__).parent.parent.parent.parent
    metadata_path = backend_path / "ml" / "artifacts" / "metadata.json"
    
    if metadata_path.exists():
        with open(metadata_path) as f:
            metadata = json.load(f)
        return {
            "model_name": metadata.get("model_name"),
            "version": metadata.get("version"),
            "threshold": metadata.get("threshold"),
            "trained_at": metadata.get("trained_at"),
            "metrics": metadata.get("test_metrics", {})
        }
    return {"error": "Aucun modèle trouvé"}


@router.get("/metrics")
def metrics():
    """Métriques de performance du modèle"""
    backend_path = Path(__file__).parent.parent.parent.parent
    eval_path = backend_path / "ml" / "artifacts" / "eval_metrics.json"
    
    if eval_path.exists():
        with open(eval_path) as f:
            return json.load(f)
    return {"error": "Métriques non disponibles"}


@router.get("/monitoring")
def monitoring():
    """Health check avancé avec monitoring"""
    backend_path = Path(__file__).parent.parent.parent.parent
    model_path = backend_path / "ml" / "artifacts" / "model.pkl"
    predictions_log = backend_path / "logs" / "predictions.jsonl"
    
    # Compter les prédictions
    pred_count = 0
    if predictions_log.exists():
        with open(predictions_log) as f:
            pred_count = sum(1 for _ in f)
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "model_loaded": model_path.exists(),
        "predictions_count": pred_count,
        "api_version": "2.1.0"
    }

@router.get("/drift")
def drift():
    """Détection de data drift — lance run_monitoring() et retourne le résumé"""
    try:
        import sys
        from pathlib import Path as P
        sys.path.insert(0, str(P(__file__).parent.parent.parent.parent))
        from ml.monitoring.drift_detector import run_monitoring
        summary = run_monitoring()
        return summary
    except Exception as e:
        return {
            "error": str(e),
            "action_required": False,
            "recommendation": "Impossible de lancer le monitoring"
        }


@router.get("/mlflow/summary")
def mlflow_summary():
    """
    Résumé du tracking MLflow : nombre total de runs et détail des 5 derniers
    (statut, métriques clés, tags) — alimente la section MLflow de Paramètres.
    """
    return mlflow_tracker.get_experiment_summary()


@router.get("/mlflow/runs/{run_id}")
def mlflow_run_detail(run_id: str):
    """Détail complet d'un run MLflow (paramètres, métriques, tags)."""
    return mlflow_tracker.get_model_info(run_id)