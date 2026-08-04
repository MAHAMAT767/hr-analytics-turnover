"""
app/api/routes/stats.py — Statistiques agrégées du dataset

Attention : le dataset IBM HR Analytics n'a aucune dimension temporelle réelle.
Le champ `evolution` est donc une série simulée — reproductible via une seed
fixe et ancrée sur le taux de turnover réellement calculé sur les données.
"""

from fastapi import APIRouter
import pandas as pd
import numpy as np
from app.config.settings import settings

router = APIRouter(prefix="/api", tags=["2. Statistiques"])


@router.get("/stats")
def stats():
    df = pd.read_csv(settings.DATA_PATH)
    df['Attrition_num'] = df['Attrition'].map({'Yes': 1, 'No': 0})

    turnover_par_dept = (
        df.groupby('Department')['Attrition_num']
        .mean()
        .round(4)
        .to_dict()
    )

    taux_turnover = round(df['Attrition_num'].mean() * 100, 1)

    # Évolution sur 12 mois, estimée depuis le taux réel
    mois_labels = ['Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc',
                    'Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin']
    rng = np.random.default_rng(42)  # seed fixe -> évolution stable au reload
    evolution = []
    valeur = taux_turnover + rng.uniform(-1.5, 1.5)
    for i, mois in enumerate(mois_labels):
        if i == len(mois_labels) - 1:
            valeur = taux_turnover  # le dernier mois colle au taux réel actuel
        else:
            valeur = np.clip(valeur + rng.uniform(-1.2, 1.2), 10, 22)
        evolution.append({"mois": mois, "taux": round(float(valeur), 1)})

    return {
        "total_employes":    len(df),
        "taux_turnover":     taux_turnover,
        "nb_departs":        int(df['Attrition_num'].sum()),
        "salaire_moyen":     round(df['MonthlyIncome'].mean(), 0),
        "turnover_par_dept": turnover_par_dept,
        "evolution":         evolution,
    }