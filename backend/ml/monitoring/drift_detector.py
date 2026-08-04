"""
ml/monitoring/drift_detector.py — Détection de drift des données et du modèle
Utilise la distance de Population Stability Index (PSI) et KS-test.
"""

import json
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from scipy import stats
import joblib

logger = logging.getLogger(__name__)

BASE_DIR      = Path(__file__).parent.parent.parent
ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"
MONITORING_DIR = Path(__file__).parent.parent.parent / "logs" / "monitoring"
MONITORING_DIR.mkdir(parents=True, exist_ok=True)


# ── PSI (Population Stability Index) ─────────────────────────────────────────
def compute_psi(expected: np.ndarray, actual: np.ndarray, buckets: int = 10) -> float:
    """
    PSI < 0.10 → stable
    PSI 0.10–0.25 → changement modéré
    PSI > 0.25 → drift significatif
    """
    min_val = min(expected.min(), actual.min())
    max_val = max(expected.max(), actual.max())
    if min_val == max_val:
        return 0.0

    breakpoints = np.linspace(min_val, max_val, buckets + 1)
    expected_pct = np.histogram(expected, bins=breakpoints)[0] / len(expected)
    actual_pct   = np.histogram(actual,   bins=breakpoints)[0] / len(actual)

    # Éviter division par zéro
    expected_pct = np.where(expected_pct == 0, 1e-6, expected_pct)
    actual_pct   = np.where(actual_pct   == 0, 1e-6, actual_pct)

    psi = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
    return float(psi)


def interpret_psi(psi: float) -> str:
    if psi < 0.10:
        return "stable"
    elif psi < 0.25:
        return "changement_modere"
    return "drift_significatif"


# ── KS Test ───────────────────────────────────────────────────────────────────
def ks_test(reference: np.ndarray, production: np.ndarray) -> dict:
    stat, pvalue = stats.ks_2samp(reference, production)
    return {
        "statistic": float(stat),
        "pvalue":    float(pvalue),
        "drift_detected": bool(pvalue < 0.05),
    }


# ── Drift sur les features numériques ─────────────────────────────────────────
def detect_feature_drift(
    reference_df: pd.DataFrame,
    production_df: pd.DataFrame,
    num_cols: list = None,
) -> dict:
    """
    Compare les distributions des features entre référence et production.
    Retourne un rapport détaillé par feature.
    """
    if num_cols is None:
        num_cols = reference_df.select_dtypes(include=[np.number]).columns.tolist()

    report = {
        "timestamp":       datetime.now().isoformat(),
        "n_reference":     len(reference_df),
        "n_production":    len(production_df),
        "features":        {},
        "summary": {
            "total_features":    len(num_cols),
            "drifted_features":  0,
            "drift_rate":        0.0,
            "alert":             False,
        },
    }

    drifted = 0
    for col in num_cols:
        if col not in reference_df.columns or col not in production_df.columns:
            continue

        ref = reference_df[col].dropna().values
        prod = production_df[col].dropna().values

        if len(ref) < 10 or len(prod) < 10:
            continue

        psi    = compute_psi(ref, prod)
        ks     = ks_test(ref, prod)
        status = interpret_psi(psi)

        report["features"][col] = {
            "psi":            round(psi, 4),
            "psi_status":     status,
            "ks_statistic":   round(ks["statistic"], 4),
            "ks_pvalue":      round(ks["pvalue"], 4),
            "ks_drift":       ks["drift_detected"],
            "ref_mean":       round(float(ref.mean()), 4),
            "prod_mean":      round(float(prod.mean()), 4),
            "ref_std":        round(float(ref.std()), 4),
            "prod_std":       round(float(prod.std()), 4),
            "drift_detected": status != "stable" or ks["drift_detected"],
        }

        if report["features"][col]["drift_detected"]:
            drifted += 1

    report["summary"]["drifted_features"] = drifted
    report["summary"]["drift_rate"]       = round(drifted / max(len(num_cols), 1), 4)
    report["summary"]["alert"]            = report["summary"]["drift_rate"] > 0.30

    return report


# ── Drift des prédictions (prediction drift) ─────────────────────────────────
def detect_prediction_drift(
    ref_probas: np.ndarray,
    prod_probas: np.ndarray,
) -> dict:
    """Compare la distribution des probabilités de prédiction."""
    psi    = compute_psi(ref_probas, prod_probas)
    ks     = ks_test(ref_probas, prod_probas)
    status = interpret_psi(psi)

    return {
        "timestamp":      datetime.now().isoformat(),
        "psi":            round(psi, 4),
        "psi_status":     status,
        "ks_statistic":   round(ks["statistic"], 4),
        "ks_pvalue":      round(ks["pvalue"], 4),
        "ref_mean_proba": round(float(ref_probas.mean()), 4),
        "prod_mean_proba":round(float(prod_probas.mean()), 4),
        "drift_detected": status != "stable",
        "alert":          psi > 0.25,
    }


# ── Sauvegarde du rapport ─────────────────────────────────────────────────────
def save_drift_report(report: dict, name: str = "drift_report") -> Path:
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = MONITORING_DIR / f"{name}_{ts}.json"
    path.write_text(json.dumps(report, indent=2, ensure_ascii=False))
    logger.info(f"Rapport drift sauvegardé: {path}")
    return path


# ── Rapport de monitoring complet ─────────────────────────────────────────────
def run_monitoring(production_df: pd.DataFrame = None) -> dict:
    """
    Lance le monitoring complet :
    1. Charge les données de référence (train set)
    2. Compare avec les données de production (si fournies)
    3. Sauvegarde le rapport
    """
    split_path = ARTIFACTS_DIR / "splits" / "test_data.joblib"

    if not split_path.exists():
        return {"error": "Données de référence introuvables. Lancez train.py d'abord."}

    X_ref, y_ref = joblib.load(split_path)

    # Si pas de données de production, simuler avec bruit (demo)
    if production_df is None:
        logger.warning("Pas de données de production fournies — simulation avec bruit.")
        num_cols = X_ref.select_dtypes(include=[np.number]).columns.tolist()
        production_df = X_ref.copy()
        for col in num_cols[:5]:  # Ajouter du drift sur 5 features
            production_df[col] = production_df[col] * np.random.uniform(0.9, 1.2)

    feature_report = detect_feature_drift(X_ref, production_df)
    save_drift_report(feature_report, "feature_drift")

    # Prédiction drift (si modèle disponible)
    model_path = ARTIFACTS_DIR / "model.pkl"
    if model_path.exists():
        model = joblib.load(model_path)
        try:
            ref_probas  = model.predict_proba(X_ref)[:, 1]
            prod_probas = model.predict_proba(production_df)[:, 1]
            pred_report = detect_prediction_drift(ref_probas, prod_probas)
            save_drift_report(pred_report, "prediction_drift")
        except Exception as e:
            pred_report = {"error": str(e)}
    else:
        pred_report = {"error": "Modèle introuvable"}

    summary = {
        "timestamp":          datetime.now().isoformat(),
        "feature_drift_alert": feature_report["summary"]["alert"],
        "prediction_drift_alert": pred_report.get("alert", False),
        "drifted_features":   feature_report["summary"]["drifted_features"],
        "drift_rate":         feature_report["summary"]["drift_rate"],
        "action_required":    feature_report["summary"]["alert"] or pred_report.get("alert", False),
        "recommendation":     (
            "⚠ Réentraînement recommandé" if feature_report["summary"]["alert"]
            else "✓ Modèle stable"
        ),
    }

    print("\n" + "=" * 60)
    print("RAPPORT DE MONITORING")
    print("=" * 60)
    print(f"  Features avec drift : {summary['drifted_features']}/{feature_report['summary']['total_features']}")
    print(f"  Taux de drift       : {summary['drift_rate']:.1%}")
    print(f"  Alerte feature      : {'⚠ OUI' if summary['feature_drift_alert'] else '✓ NON'}")
    print(f"  Alerte prédiction   : {'⚠ OUI' if summary['prediction_drift_alert'] else '✓ NON'}")
    print(f"  → {summary['recommendation']}")
    print("=" * 60)

    return summary


if __name__ == "__main__":
    run_monitoring()