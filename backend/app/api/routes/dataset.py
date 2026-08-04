"""
app/api/routes/dataset.py — Exposition du dataset et de ses agrégats métier
(taux de turnover par heures supplémentaires, satisfaction, poste, distance,
et distributions par tranche d'âge et de salaire).
"""

from fastapi import APIRouter
import pandas as pd
import numpy as np
from app.config.settings import settings

router = APIRouter(prefix="/api", tags=["3. Dataset"])

# Chargement unique au démarrage
DF = pd.read_csv(settings.DATA_PATH)
DF['Attrition_num'] = DF['Attrition'].map({'Yes': 1, 'No': 0})


def _turnover_by(col: str) -> dict:
    """Taux de turnover groupé par une colonne catégorielle."""
    return (
        DF.groupby(col)['Attrition_num']
        .mean()
        .round(4)
        .to_dict()
    )


def _dist_tranches(col: str, bins: list, labels: list) -> list:
    """Distribution {tranche, total, departs} pour les tranches numériques."""
    cut = pd.cut(DF[col], bins=bins, labels=labels, right=True)
    result = []
    for label in labels:
        mask   = cut == label
        total  = int(mask.sum())
        departs = int(DF.loc[mask, 'Attrition_num'].sum())
        result.append({"tranche": label, "total": total, "departs": departs})
    return result


@router.get("/dataset")
def dataset():
    # ── liste complète des employés ────────────────────────────────
    employes = DF.replace({np.nan: None}).to_dict(orient='records')

    # ── heures sup vs turnover ──────────────────────────────────────
    heures_sup = _turnover_by('OverTime')

    # ── satisfaction (1-4) vs turnover ─────────────────────────────
    satisf_turn = _turnover_by('JobSatisfaction')

    # ── poste vs turnover ──────────────────────────────────────────
    poste_turn = _turnover_by('JobRole')

    # ── distance domicile (tranches) vs turnover ───────────────────
    dist_bins   = [0, 5, 10, 15, 20, 30]
    dist_labels = ['1-5', '6-10', '11-15', '16-20', '21-30']
    dist_turn = {
        row['tranche']: round(row['departs'] / row['total'], 4) if row['total'] > 0 else 0
        for row in _dist_tranches('DistanceFromHome', dist_bins, dist_labels)
    }

    # ── distribution âges ──────────────────────────────────────────
    age_bins   = [17, 25, 30, 35, 40, 50, 99]
    age_labels = ['18-25', '26-30', '31-35', '36-40', '41-50', '51+']
    dist_age   = _dist_tranches('Age', age_bins, age_labels)

    # ── distribution salaires ──────────────────────────────────────
    sal_bins   = [0, 3000, 5000, 8000, 12000, 25000]
    sal_labels = ['<3k', '3-5k', '5-8k', '8-12k', '12k+']
    dist_sal   = _dist_tranches('MonthlyIncome', sal_bins, sal_labels)

    return {
        # données brutes
        "employes":       employes,
        # agrégats métier
        "heures_sup":     heures_sup,
        "satisf_turn":    satisf_turn,
        "poste_turn":     poste_turn,
        "dist_turn":      dist_turn,
        "dist_age":       dist_age,
        "dist_sal":       dist_sal,
        # compatibilité
        "total_employes": len(DF),
        "colonnes":       list(DF.columns),
        "apercu":         DF.head(10).replace({np.nan: None}).to_dict(orient='records'),
    }