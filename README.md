# HR Analytics — Système Intelligent de Prédiction du Turnover

Projet de mémoire (Master 2). Plateforme MLOps de prédiction et d'explication du
risque de départ (turnover) des employés, composée d'une API FastAPI, d'un
pipeline ML industrialisé et d'une interface React TypeScript.

## Fonctionnalités

- **Prédiction** du risque de turnover d'un employé (probabilité + décision au seuil optimisé)
- **Explicabilité** des prédictions via SHAP (summary, waterfall, importance globale)
- **Analyse statistique** du dataset RH et import de nouveaux datasets
- **Assistant IA** conversationnel spécialisé RH (Hugging Face Inference API)
- **Monitoring MLOps** : suivi MLflow, détection de dérive (drift), métriques temps réel via WebSocket

## Stack technique

| Couche | Technologies |
|---|---|
| API | FastAPI, Pydantic, Uvicorn |
| ML | scikit-learn, imbalanced-learn (SMOTE), SHAP |
| MLOps | MLflow, registre de modèles versionnés, détection de drift |
| Frontend | React, TypeScript |
| CI/CD | GitHub Actions |

Modèle : régression logistique (alternative Random Forest), seuil optimisé pour
un recall cible de 0.70.

## Structure du dépôt

```
backend/
  app/
    api/routes/     # predict, stats, dataset, chat, mlops
    core/           # configuration, logging
    services/       # model_service, shap_service, chat_service,
                    # mlflow_tracker, survival_service
    schemas/        # modèles Pydantic
  ml/
    train.py        # entraînement
    evaluate.py     # évaluation
    explain.py      # explicabilité SHAP
    run_all.py      # pipeline complet
    monitoring/     # détection de dérive
    artifacts/      # modèles, métriques et graphiques SHAP versionnés
  tests/            # tests API (pytest)
rh-analytics/       # frontend React TypeScript
.github/workflows/  # pipeline CI/CD MLOps
```

## Installation

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

Créer le fichier `backend/.env` à partir du modèle fourni :

```bash
cp env.example .env
```

puis renseigner `HF_TOKEN` avec un token Hugging Face
(https://huggingface.co/settings/tokens).

### Frontend

```bash
cd rh-analytics
npm install
```

## Utilisation

Entraîner le modèle (à faire avant le premier démarrage de l'API) :

```bash
cd backend
python ml/run_all.py
```

Lancer l'API :

```bash
uvicorn app.main:app --reload --port 8000
```

Documentation interactive : http://localhost:8000/docs

Lancer le frontend :

```bash
cd rh-analytics
npm start
```

## Tests

```bash
cd backend
pytest tests/
```

## Principaux endpoints

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/predict` | Prédiction du risque de turnover |
| GET | `/api/stats` | Statistiques RH agrégées |
| POST | `/api/dataset` | Import et analyse d'un nouveau dataset |
| POST | `/api/chat` | Assistant IA RH |
| GET | `/api/model-info` | Métadonnées du modèle en production |
| GET | `/api/metrics` | Métriques d'évaluation |
| GET | `/api/monitoring` | État du monitoring |
| WS | `/ws/network` | Flux temps réel (statut, événements) |
| GET | `/health` | Health check |

## Note sur les secrets

Aucun secret ne doit être commité. Le fichier `backend/.env` est ignoré par git ;
seul `backend/env.example` (sans valeurs) est versionné.
