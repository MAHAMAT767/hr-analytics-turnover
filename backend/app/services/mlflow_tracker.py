"""
app/services/mlflow_tracker.py — Wrapper MLflow pour le tracking (version corrigée)
"""

import mlflow
from mlflow.tracking import MlflowClient
from typing import Dict, Any, Optional
from pathlib import Path
from ..core.config import settings
from ..core.logging import logger

class MLflowTracker:
    """Wrapper MLflow pour le tracking des expériences (sans model registry)"""
    
    def __init__(self):
        # ⭐ Configuration explicite avec SQLite comme dans train.py
        self.base_dir = Path(__file__).parent.parent.parent
        self.db_path = self.base_dir / "mlflow.db"
        self.mlruns_dir = self.base_dir / "mlruns"
        
        # Créer les dossiers
        self.mlruns_dir.mkdir(parents=True, exist_ok=True)
        
        # ⭐ Utiliser SQLite comme backend (pas de model registry)
        self.tracking_uri = f"sqlite:///{self.db_path.absolute()}"
        mlflow.set_tracking_uri(self.tracking_uri)
        
        # ⭐ Ne PAS utiliser set_experiment avec SQLite
        # À la place, on stocke l'expérience comme métadonnée
        self.experiment_name = settings.MLFLOW_EXPERIMENT_NAME
        
        # Initialiser le client
        self.client = MlflowClient(tracking_uri=self.tracking_uri)
        
        logger.info(f"MLflow configuré avec SQLite: {self.tracking_uri}")
        logger.info(f"Expérience: {self.experiment_name}")
    
    def log_prediction(self, run_id: str, input_data: Dict, 
                       prediction: Dict, latency_ms: float):
        """Log une prédiction dans MLflow"""
        try:
            with mlflow.start_run(run_id=run_id, nested=True):
                mlflow.log_params({
                    "prediction_input": str(input_data)[:500],  # Limiter la taille
                    "prediction_latency_ms": latency_ms
                })
                mlflow.log_metrics({
                    "prediction_proba": prediction.get("probabilite", 0),
                    "prediction_risk_score": prediction.get("probabilite", 0)
                })
        except Exception as e:
            logger.warning(f"Impossible de logger la prédiction dans MLflow: {e}")
    
    def get_model_info(self, run_id: str) -> Dict:
        """Récupère les infos d'un modèle depuis MLflow"""
        try:
            run = self.client.get_run(run_id)
            return {
                "run_id": run.info.run_id,
                "status": run.info.status,
                "start_time": run.info.start_time,
                "params": run.data.params,
                "metrics": run.data.metrics,
                "tags": run.data.tags
            }
        except Exception as e:
            logger.error(f"Erreur récupération modèle MLflow: {e}")
            return {"error": str(e)}
    
    def get_experiment_summary(self) -> Dict:
        """Résumé de l'expérience MLflow"""
        try:
            # ⚠️ FIX : search_runs(experiment_ids=[]) ne cherche dans AUCUNE
            # expérience et renvoie toujours une liste vide. Il faut d'abord
            # lister les expériences existantes (créées par train.py) pour
            # récupérer leurs IDs.
            experiments = self.client.search_experiments()
            experiment_ids = [exp.experiment_id for exp in experiments] or ["0"]

            runs = self.client.search_runs(
                experiment_ids=experiment_ids,
                order_by=["start_time DESC"],
                max_results=10
            )

            return {
                "experiment_name": self.experiment_name,
                "total_runs": len(runs),
                "latest_runs": [
                    {
                        "run_id": r.info.run_id,
                        "status": r.info.status,
                        "start_time": r.info.start_time,
                        "run_name": r.data.tags.get("mlflow.runName"),
                        "metrics": {k: v for k, v in r.data.metrics.items() 
                                   if k in ['roc_auc', 'f1', 'recall', 'precision']},
                        "tags": r.data.tags
                    }
                    for r in runs[:5]
                ],
                "tracking_uri": self.tracking_uri
            }
        except Exception as e:
            logger.error(f"Erreur récupération summary MLflow: {e}")
            return {"error": str(e), "total_runs": 0}

# Instance globale
mlflow_tracker = MLflowTracker()