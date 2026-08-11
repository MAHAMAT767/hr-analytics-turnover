# HR Analytics — Prédiction du turnover des employés

![Python](https://img.shields.io/badge/Python-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![MLflow](https://img.shields.io/badge/MLflow-0194E2?style=flat&logo=mlflow&logoColor=white)
![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?style=flat&logo=githubactions&logoColor=white)

Projet de mémoire (Master 2). Plateforme MLOps de prédiction et d'explication du risque de départ (turnover) des employés, composée d'une API FastAPI, d'un pipeline ML industrialisé et d'une interface React TypeScript.

---

## Le problème

Le départ imprévu d'un employé coûte cher à une entreprise : recrutement, formation, perte de savoir-faire, désorganisation d'équipe. L'enjeu n'est pas seulement de prédire *qui* va partir, mais de le faire suffisamment tôt et de façon **explicable**, pour que les RH puissent agir — pas juste subir un chiffre.

Ce projet privilégie volontairement le **recall** (détecter un maximum de départs réels) plutôt que la précision brute : dans ce contexte métier, rater un départ à risque coûte plus cher qu'une fausse alerte RH.

---

## Résultats clés

Modèle en production : **Régression logistique** (alternative Random Forest disponible), seuil de décision optimisé à **0,601**.

| Métrique | Valeur |
|---|---|
| ROC-AUC | 0,796 |
| Accuracy | 0,78 |
| Recall | 0,53 |
| Precision | 0,41 |
| F1-score | 0,46 |

Dataset : 1 470 employés (IBM HR Analytics Attrition Dataset).

> Le recall actuel (0,53) est en dessous de la cible visée (0,70) — piste d'amélioration identifiée : recalibrer le seuil de décision ou tester un modèle non linéaire (Random Forest, XGBoost) pour mieux capturer les interactions entre variables.

---

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
  tests/            # tests API (pytest) — 17/17 au vert
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

puis renseigner `HF_TOKEN` avec un token Hugging Face (https://huggingface.co/settings/tokens).

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

## Limites connues

- Recall actuel (0,53) sous la cible métier (0,70) — le modèle manque encore trop de départs réels
- Dataset de taille modeste (1 470 employés), synthétique (IBM), pas des données réelles d'entreprise
- Le module d'analyse de survie (`survival_service`) est présent dans le code mais pas encore exposé comme fonctionnalité principale

## Améliorations envisagées

- Recalibrer le seuil de décision ou tester des modèles non linéaires (Random Forest, XGBoost) pour améliorer le recall
- Valider le modèle sur un jeu de données RH réel
- Exposer l'analyse de survie (temps avant départ estimé, pas seulement probabilité binaire)

## Note sur les secrets

Aucun secret ne doit être commité. Le fichier `backend/.env` est ignoré par git ; seul `backend/env.example` (sans valeurs) est versionné.

## Auteur

**Mahamat Haroun Ibrahim** — Master 2 Informatique de Gestion, UCAO Sénégal
