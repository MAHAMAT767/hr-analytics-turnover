#  HR Analytics — Prédiction du Turnover des Employés

> **Mémoire de Master 2 — Informatique de Gestion | UCAO Dakar**  
> Auteur : **Mahamat Haroun Ibrahim**

---

##  Description

Ce projet étudie comment l'**Intelligence Artificielle** et les **modèles explicables (XAI)** peuvent améliorer la prédiction du turnover des employés tout en garantissant des décisions RH **compréhensibles et éthiques**.

---

##  Objectifs

- Prédire la probabilité de départ d'un employé
- Identifier les facteurs clés du turnover
- Expliquer chaque prédiction avec **SHAP**
- Analyser les biais et garantir l'équité algorithmique

---

##  Dataset

| Propriété | Valeur |
|-----------|--------|
| Source | IBM HR Analytics (Kaggle) |
| Employés | 1 470 |
| Variables | 35 |
| Taux d'attrition | 16.1% |

---

##  Technologies

| Catégorie | Outils |
|-----------|--------|
| Langage | Python 3.10 |
| ML | XGBoost, Scikit-learn |
| XAI | SHAP (TreeExplainer) |
| Visualisation | Matplotlib, Seaborn |
| Notebook | Jupyter |

---

## Structure du Projet

```
hr-analytics-turnover/
│
├── hr_analytics_turnover.ipynb     # Notebook principal
├── WA_Fn-UseC_-HR-Employee-Attrition.csv  # Dataset
├── requirements.txt
│
├── plots/                          # Graphiques générés
│   ├── 01_distribution_cible.png
│   ├── 02_variables_cles.png
│   ├── 03_variables_categorielles.png
│   ├── 04_correlation.png
│   ├── 05_evaluation.png
│   ├── 07_shap_summary.png
│   ├── 08_shap_bar.png
│   ├── 09_shap_waterfall.png
│   └── 10_biais.png
│
└── models/
    └── xgb_turnover_model.pkl      # Modèle entraîné
```

---

##  Installation

```bash
git clone https://github.com/MAHAMAT767/hr-analytics-turnover.git
cd hr-analytics-turnover
pip install -r requirements.txt
jupyter notebook hr_analytics_turnover.ipynb
```

---

##  Résultats

| Métrique | Score |
|----------|-------|
| AUC-ROC | **~0.84** |
| Recall (attrition) | **~78%** |
| F1-Score | **~72%** |

---

##  Axes du Projet (Mémoire)

| Axe | Description |
|-----|-------------|
| HR Analytics | Analyse des données RH |
| Machine Learning | XGBoost + validation croisée |
| IA Générative | Génération de recommandations RH |
| XAI | Explicabilité avec SHAP / LIME |
| Éthique | Analyse des biais, équité algorithmique |

---

## Éthique et Transparence

Ce projet accorde une importance particulière à :
- Le **droit à l'explication** (RGPD Art. 22)
- La **détection des biais** (genre, département)
- La **transparence** des décisions algorithmiques
- L'**auditabilité** du modèle

---

## 👤 Auteur

**Mahamat Haroun Ibrahim**   
📧 mottiharoun3@icloud.com  
🔗 [GitHub](https://github.com/MAHAMAT767)  
