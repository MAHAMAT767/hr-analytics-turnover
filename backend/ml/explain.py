"""
ml/explain.py — Explicabilité SHAP avec logging MLflow
"""

import json
import joblib
import logging
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import shap
import mlflow
from pathlib import Path
from datetime import datetime

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR      = Path(__file__).parent.parent
ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
SPLITS_DIR    = ARTIFACTS_DIR / "splits"
SHAP_DIR      = ARTIFACTS_DIR / "shap"
MLRUNS_DIR    = BASE_DIR / "mlruns"
DB_PATH       = BASE_DIR / "mlflow.db"

SHAP_DIR.mkdir(parents=True, exist_ok=True)


# ✅ FIX : importer build_features depuis train.py pour désérialiser le pipeline
import sys as _sys
_sys.path.insert(0, str(Path(__file__).parent))
from train import build_features  # noqa: F401 — nécessaire pour joblib.load()


def load_model_and_data():
    model_path = ARTIFACTS_DIR / "model.pkl"
    split_path = SPLITS_DIR / "test_data.joblib"
    if not model_path.exists():
        raise FileNotFoundError("Modèle introuvable. Lancez train.py d'abord.")
    if not split_path.exists():
        raise FileNotFoundError("Données de test introuvables. Lancez train.py d'abord.")
    model = joblib.load(model_path)
    X_test, y_test = joblib.load(split_path)
    logger.info(f"Modèle et données chargés: {len(X_test)} échantillons")
    return model, X_test, y_test


def generate_shap_explanations():
    logger.info("Génération des explications SHAP...")

    mlflow.set_tracking_uri(f"sqlite:///{DB_PATH.absolute()}")
    # set_experiment commenté : on logue dans le run existant via run_id

    # Charger métadonnées pour récupérer le run_id
    meta_path = ARTIFACTS_DIR / "metadata.json"
    run_id    = None
    if meta_path.exists():
        run_id = json.loads(meta_path.read_text()).get("mlflow_run_id")

    model, X_test, y_test = load_model_and_data()

    # Extraire préprocesseur + classifieur depuis le pipeline
    if hasattr(model, "named_steps"):
        fe_step     = model.named_steps.get("feature_engineer")
        preprocessor = model.named_steps.get("preprocessor")
        clf          = model.named_steps.get("model")
    else:
        fe_step = preprocessor = None
        clf = model

    # Appliquer FE + preprocessing
    if fe_step is not None:
        X_fe = fe_step.transform(X_test)
    else:
        X_fe = X_test

    if preprocessor is not None:
        X_transformed   = preprocessor.transform(X_fe)
        feature_names   = preprocessor.get_feature_names_out()
    else:
        X_transformed = X_fe.values if hasattr(X_fe, "values") else X_fe
        feature_names = list(X_fe.columns) if hasattr(X_fe, "columns") else [f"f{i}" for i in range(X_transformed.shape[1])]

    n_samples = min(100, len(X_test))
    X_sample  = X_transformed[:n_samples]

    model_type = "logreg" if "LogisticRegression" in type(clf).__name__ else "rf"
    logger.info(f"Type de modèle: {model_type}")

    # ── Explainer ─────────────────────────────────────────────────────────
    if model_type == "rf":
        explainer  = shap.TreeExplainer(clf)
        shap_values = explainer.shap_values(X_sample)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]
    else:
        background  = shap.sample(X_transformed, min(100, len(X_transformed)))
        explainer   = shap.LinearExplainer(clf, background)
        shap_values = explainer.shap_values(X_sample)
        if hasattr(shap_values, "shape") and len(shap_values.shape) == 3:
            shap_values = shap_values[:, :, 1]

    logger.info(f"SHAP values shape: {shap_values.shape}")

    # ── Visualisations ────────────────────────────────────────────────────
    # 1. Summary plot
    fig, ax = plt.subplots(figsize=(12, 8))
    shap.summary_plot(shap_values, X_sample, feature_names=feature_names, show=False, max_display=15)
    plt.tight_layout()
    plt.savefig(SHAP_DIR / "shap_summary.png", dpi=150, bbox_inches="tight")
    plt.close()

    # 2. Bar plot
    fig, ax = plt.subplots(figsize=(10, 6))
    shap.summary_plot(shap_values, X_sample, feature_names=feature_names,
                      plot_type="bar", show=False, max_display=15)
    plt.tight_layout()
    plt.savefig(SHAP_DIR / "shap_bar.png", dpi=150, bbox_inches="tight")
    plt.close()

    # 3. Waterfall pour le profil à risque le plus élevé
    try:
        high_risk_idx  = int(np.argmax(np.abs(shap_values).mean(axis=1)))
        expected_value = explainer.expected_value
        if isinstance(expected_value, (list, np.ndarray)) and len(np.atleast_1d(expected_value)) > 1:
            expected_value = float(np.atleast_1d(expected_value)[1])
        else:
            expected_value = float(expected_value)

        plt.figure(figsize=(10, 8))
        shap.waterfall_plot(
            shap.Explanation(
                values=shap_values[high_risk_idx],
                base_values=expected_value,
                data=X_sample[high_risk_idx],
                feature_names=feature_names,
            ),
            show=False, max_display=10,
        )
        plt.tight_layout()
        plt.savefig(SHAP_DIR / "shap_waterfall.png", dpi=150, bbox_inches="tight")
        plt.close()
        logger.info("Waterfall plot sauvegardé")
    except Exception as e:
        logger.warning(f"Waterfall non généré: {e}")

    # ── Insights JSON ─────────────────────────────────────────────────────
    mean_abs  = np.abs(shap_values).mean(axis=0)
    top_idx   = np.argsort(mean_abs)[-10:][::-1]

    insights = {
        "model_type": model_type,
        "n_samples_explained": n_samples,
        "generated_at": datetime.now().isoformat(),
        "top_drivers": [
            {
                "rank":        i + 1,
                "feature":     str(feature_names[idx]),
                "importance":  float(mean_abs[idx]),
                "mean_effect": float(shap_values[:, idx].mean()),
                "direction":   "augmente" if shap_values[:, idx].mean() > 0 else "diminue",
            }
            for i, idx in enumerate(top_idx[:10])
        ],
    }

    (SHAP_DIR / "shap_insights.json").write_text(json.dumps(insights, indent=2, ensure_ascii=False))

    # Copier vers artifacts/ racine pour l'API
    import shutil
    shutil.copy(SHAP_DIR / "shap_summary.png", ARTIFACTS_DIR / "shap_summary.png")
    (ARTIFACTS_DIR / "shap_insights.json").write_text(
        json.dumps(insights, indent=2, ensure_ascii=False)
    )

    # ── Log MLflow ────────────────────────────────────────────────────────
    ctx = mlflow.start_run(run_id=run_id) if run_id else mlflow.start_run(run_name="shap_explain")
    with ctx:
        for png in ["shap_summary.png", "shap_bar.png", "shap_waterfall.png"]:
            p = SHAP_DIR / png
            if p.exists():
                mlflow.log_artifact(str(p), artifact_path="shap")
        mlflow.log_artifact(str(SHAP_DIR / "shap_insights.json"), artifact_path="shap")
        mlflow.log_metric("shap_top1_importance", float(mean_abs[top_idx[0]]))

    # ── Console ───────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("TOP 10 DRIVERS DE TURNOVER (SHAP)")
    print("=" * 60)
    for d in insights["top_drivers"][:5]:
        print(f"  {d['rank']}. {d['feature']}")
        print(f"     Importance : {d['importance']:.4f} | {d['direction']} le risque")
    print("=" * 60)

    return insights


if __name__ == "__main__":
    generate_shap_explanations()