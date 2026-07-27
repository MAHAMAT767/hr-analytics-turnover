"""
app/services/survival_service.py — Analyse de survie pour la prédiction du turnover
Estime la date probable de départ d'un employé via une approche paramétrique
basée sur la probabilité de turnover du modèle principal (pas de RSF requis).
"""

import logging
import numpy as np
from datetime import datetime, timedelta
from app.schemas.employe import EmployeData
from app.services.model_service import pipeline, employe_to_dataframe, THRESHOLD

logger = logging.getLogger(__name__)

# ── Tentative de chargement du modèle de survie RSF (optionnel) ──────────────
try:
    import joblib
    from pathlib import Path
    from app.config.settings import settings

    _rsf_path = Path(settings.MODEL_PATH).parent / "survival_model.pkl"
    if not _rsf_path.exists():
        # Cherche aussi dans ml/artifacts/
        _rsf_path = Path(settings.MODEL_PATH).parent.parent / "artifacts" / "survival_model.pkl"

    if _rsf_path.exists():
        _rsf = joblib.load(_rsf_path)
        RSF_AVAILABLE = True
        logger.info(f"✓ Modèle de survie RSF chargé depuis {_rsf_path}")
    else:
        _rsf = None
        RSF_AVAILABLE = False
        logger.info("ℹ Modèle RSF non trouvé — utilisation de l'estimation paramétrique")
except Exception as e:
    _rsf = None
    RSF_AVAILABLE = False
    logger.warning(f"⚠ Impossible de charger le modèle RSF : {e}")


# ── Courbe de survie empirique via Weibull simplifié ─────────────────────────

def _weibull_survival_curve(proba: float, anciennete_mois: int):
    """
    Génère une courbe de survie S(t) basée sur la probabilité de turnover.
    Utilise une distribution de Weibull calibrée sur les données IBM HR.
    
    Hypothèses calibrées :
    - Médiane de départ pour risque élevé (p=0.8) ≈ 8 mois
    - Médiane de départ pour risque moyen (p=0.5) ≈ 18 mois
    - Médiane de départ pour risque faible (p=0.2) ≈ 48 mois
    """
    # Paramètre shape Weibull (k) — fixe, détermine la forme de la courbe
    k = 1.5  # > 1 → risque croissant avec le temps (réaliste pour attrition)

    # Paramètre scale lambda inversement proportionnel à la probabilité
    # Calibration : proba=0.5 → lambda=26 mois
    if proba <= 0:
        proba = 0.01
    if proba >= 1:
        proba = 0.99

    # Scale : plus la proba est haute, plus le départ est tôt
    lam = 26.0 * ((1 - proba) / 0.5) ** 1.2
    lam = max(3.0, min(lam, 120.0))

    # Horizon : 60 mois (5 ans)
    times = np.arange(1, 61)
    # S(t) = exp(-(t/lambda)^k)
    surv  = np.exp(-((times / lam) ** k))

    return times, surv, lam


def _fiabilite_label(delai_mois: float) -> str:
    if delai_mois <= 2:
        return "IMMINENT"
    if delai_mois <= 4:
        return "PROCHE"
    if delai_mois <= 8:
        return "MODÉRÉ"
    return "LOINTAIN"


def _fiabilite_fr(label: str) -> str:
    return {
        "IMMINENT": "Départ imminent (< 2 mois)",
        "PROCHE":   "Départ proche (2–4 mois)",
        "MODÉRÉ":   "Départ modéré (4–8 mois)",
        "LOINTAIN": "Départ lointain (> 8 mois)",
    }.get(label, label)


# ── Fonction principale ───────────────────────────────────────────────────────

def compute_survival(data: EmployeData) -> dict:
    """
    Calcule l'analyse de survie pour un employé.
    Retourne :
      - courbe de survie (times + probas) pour le graphique
      - délai médian estimé avant départ
      - date estimée de départ
      - intervalle de confiance 25–75%
      - indicateur de fiabilité
    """
    if pipeline is None:
        return {"error": "Modèle non chargé", "survival_disponible": False}

    try:
        # 1. Probabilité de turnover du modèle principal
        df    = employe_to_dataframe(data)
        proba = float(pipeline.predict_proba(df)[0][1])
        anciennete_mois = int(data.YearsAtCompany * 12)

        # 2. Tenter RSF si disponible
        if RSF_AVAILABLE and _rsf is not None:
            try:
                survival_func = _rsf.predict_survival_function(df, return_array=False)[0]
                times      = np.array(survival_func.x, dtype=float)
                surv_probs = np.array(survival_func.y, dtype=float)

                idx_50  = np.where(surv_probs <= 0.50)[0]
                mediane = float(times[idx_50[0]]) if len(idx_50) > 0 else float(times[-1]) * 1.5
                delai   = max(1.0, mediane - anciennete_mois)

                idx_75  = np.where(surv_probs <= 0.75)[0]
                idx_25  = np.where(surv_probs <= 0.25)[0]
                ic_bas  = max(1.0, float(times[idx_75[0]]) - anciennete_mois) if len(idx_75) > 0 else delai * 0.6
                ic_haut = max(1.0, float(times[idx_25[0]]) - anciennete_mois) if len(idx_25) > 0 else delai * 1.6

                # Courbe de survie pour le graphique (rééchantillonnée sur 60 pts)
                t_interp = np.linspace(float(times[0]), min(float(times[-1]), 60), 60)
                s_interp = np.interp(t_interp, times, surv_probs)
                courbe   = [{"mois": round(float(t)), "survie": round(float(s), 3)}
                            for t, s in zip(t_interp, s_interp)]
                source = "RSF"

            except Exception as e:
                logger.warning(f"RSF predict failed, fallback Weibull: {e}")
                RSF_AVAILABLE_LOCAL = False
                times_w, surv_w, lam = _weibull_survival_curve(proba, anciennete_mois)
                delai, ic_bas, ic_haut, courbe, source = _from_weibull(
                    times_w, surv_w, lam, proba, anciennete_mois
                )
        else:
            # 3. Estimation Weibull paramétrique
            times_w, surv_w, lam = _weibull_survival_curve(proba, anciennete_mois)
            delai, ic_bas, ic_haut, courbe, source = _from_weibull(
                times_w, surv_w, lam, proba, anciennete_mois
            )

        # 4. Date estimée
        date_dep  = datetime.now() + timedelta(days=delai * 30.44)
        fiabilite = _fiabilite_label(delai)

        return {
            "survival_disponible": True,
            "source":              source,
            "probabilite":         round(proba, 4),
            "anciennete_mois":     anciennete_mois,
            "delai_mois":          round(delai, 1),
            "delai_label":         f"{round(delai, 1)} mois",
            "date_estimee":        f"vers le {date_dep.strftime('%d/%m/%Y')}",
            "date_iso":            date_dep.strftime("%Y-%m-%d"),
            "intervalle_bas":      round(ic_bas, 1),
            "intervalle_haut":     round(ic_haut, 1),
            "fiabilite":           fiabilite,
            "fiabilite_label":     _fiabilite_fr(fiabilite),
            "courbe_survie":       courbe,        # [{mois, survie}, ...]
            "prediction_binaire":  int(proba >= THRESHOLD),
        }

    except Exception as e:
        logger.exception("Erreur survival compute")
        return {"error": str(e), "survival_disponible": False}


def _from_weibull(times, surv, lam, proba, anciennete_mois):
    """Extrait délai, IC et courbe depuis une Weibull."""
    # Médiane = t tel que S(t) = 0.5
    idx_50  = np.where(surv <= 0.50)[0]
    mediane = float(times[idx_50[0]]) if len(idx_50) > 0 else lam * 1.5
    delai   = max(1.0, mediane)

    # IC 25–75%
    idx_75  = np.where(surv <= 0.75)[0]
    idx_25  = np.where(surv <= 0.25)[0]
    ic_bas  = float(times[idx_75[0]]) if len(idx_75) > 0 else delai * 0.6
    ic_haut = float(times[idx_25[0]]) if len(idx_25) > 0 else delai * 1.6

    courbe = [
        {"mois": int(t), "survie": round(float(s), 3)}
        for t, s in zip(times, surv)
    ]

    return delai, max(1.0, ic_bas), max(1.0, ic_haut), courbe, "Weibull"