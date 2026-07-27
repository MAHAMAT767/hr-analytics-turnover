"""
app/main.py — Point d'entrée FastAPI avec architecture MLOps unifiée
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.routes import predict, stats, dataset, chat, mlops

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("Démarrage de l'API HR Analytics v2.1.0")

    try:
        from app.services.model_service import pipeline, MODEL_NAME, THRESHOLD
        if pipeline is not None:
            logger.info(f"✓ Modèle chargé: {MODEL_NAME} | seuil={THRESHOLD}")
        else:
            logger.warning("⚠ Aucun modèle chargé. Lancez ml/train.py d'abord.")
    except Exception as e:
        logger.error(f"✗ Erreur au démarrage: {e}")

    logger.info("=" * 60)
    yield
    logger.info("Arrêt de l'API HR Analytics")


app = FastAPI(
    title="HR Analytics API",
    description="""
## Système Intelligent de Prédiction du Turnover

Cette API MLOps permet de :
- **Prédire** le risque de turnover d'un employé
- **Expliquer** les prédictions avec SHAP
- **Analyser** les statistiques RH
- **Dialoguer** avec un assistant IA spécialisé RH
- **Monitorer** les performances du modèle

### Modèle ML
- Type : `logreg` (Logistic Regression) ou `rf` (Random Forest)
- Seuil optimisé : 0.42 (recall cible = 0.70)
- Framework : scikit-learn + imbalanced-learn (SMOTE)

### Technologies
- FastAPI pour l'API REST
- MLflow pour le tracking
- SHAP pour l'explicabilité
    """,
    version="2.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routes avec préfixe /api
app.include_router(predict.router)   
app.include_router(stats.router)     
app.include_router(dataset.router)   
app.include_router(chat.router)      
app.include_router(mlops.router)     


# ── ✅ FIX #6 : WebSocket /ws/network ───────────────────────────────────

BACKEND_ROOT     = Path(__file__).resolve().parent.parent
MODEL_PATH       = BACKEND_ROOT / "ml" / "artifacts" / "model.pkl"
PREDICTIONS_LOG  = BACKEND_ROOT / "logs" / "predictions.jsonl"


def _count_predictions() -> int:
    if PREDICTIONS_LOG.exists():
        with open(PREDICTIONS_LOG) as f:
            return sum(1 for _ in f)
    return 0


@app.websocket("/ws/network")
async def ws_network(websocket: WebSocket):
    await websocket.accept()

    last_model_loaded = MODEL_PATH.exists()
    last_pred_count   = _count_predictions()

    # Message initial — confirme la connexion et donne l'état courant
    now = datetime.now()
    await websocket.send_json({
        "status": {
            "gateway":    "FastAPI · HR Analytics API",
            "online":     True,
            "latency_ms": 1,
            "last_check": now.isoformat(),
        },
        "events": [{
            "type":  "info",
            "titre": "Monitoring temps réel connecté",
            "desc":  (
                f"Modèle {'chargé' if last_model_loaded else 'non chargé'} · "
                f"{last_pred_count} prédiction(s) enregistrée(s)."
            ),
            "time": now.strftime("%H:%M:%S"),
        }],
    })

    try:
        while True:
            await asyncio.sleep(10)

            t0 = datetime.now()
            model_loaded = MODEL_PATH.exists()
            pred_count   = _count_predictions()
            latency_ms   = max(1, int((datetime.now() - t0).total_seconds() * 1000))
            now          = datetime.now()

            events = []

            if model_loaded != last_model_loaded:
                events.append({
                    "type":  "info" if model_loaded else "danger",
                    "titre": "Modèle chargé" if model_loaded else "Modèle déchargé",
                    "desc":  (
                        "Le modèle ML a été rechargé avec succès."
                        if model_loaded else
                        "Le fichier model.pkl est introuvable — le modèle n'est plus chargé."
                    ),
                    "time": now.strftime("%H:%M:%S"),
                })

            if pred_count > last_pred_count:
                nb = pred_count - last_pred_count
                events.append({
                    "type":  "info",
                    "titre": "Nouvelle(s) prédiction(s)",
                    "desc":  f"{nb} nouvelle(s) prédiction(s) enregistrée(s) (total : {pred_count}).",
                    "time": now.strftime("%H:%M:%S"),
                })

            last_model_loaded = model_loaded
            last_pred_count   = pred_count

            await websocket.send_json({
                "status": {
                    "gateway":    "FastAPI · HR Analytics API",
                    "online":     True,
                    "latency_ms": latency_ms,
                    "last_check": now.isoformat(),
                },
                "events": events,
            })
    except WebSocketDisconnect:
        pass


# Endpoints racine (sans préfixe /api)
@app.get("/", tags=["Root"])
def root():
    return {
        "app": "HR Analytics API",
        "version": "2.1.0",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "prediction": "/api/predict",
            "stats": "/api/stats",
            "dataset": "/api/dataset",
            "chat": "/api/chat",
            "model_info": "/api/model-info",
            "metrics": "/api/metrics",
            "monitoring": "/api/monitoring",
            "network_ws": "/ws/network"
        }
    }


@app.get("/health", tags=["Root"])
def health():
    return {"status": "ok", "api": "hr_analytics", "version": "2.1.0"}