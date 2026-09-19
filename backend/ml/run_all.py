"""
ml/run_all.py — Orchestrateur du pipeline MLOps complet
Usage :
    python run_all.py               # train + eval + explain
    python run_all.py --skip-shap   # train + eval seulement
    python run_all.py --eval-only   # évaluation seule
"""

import sys
import logging
import argparse
import traceback
from datetime import datetime
from pathlib import Path

# La console Windows est en cp1252 et ne sait pas encoder les symboles du
# rapport final (checkmark, fleche). Meme correctif que dans app/main.py.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

# Le dossier logs/ n'est pas versionne : il faut le creer avant le FileHandler,
# sinon le pipeline echoue des l'import sur un clone neuf (runner CI compris).
LOG_DIR = Path(__file__).parent.parent / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "ml_pipeline.log"),
    ],
)
logger = logging.getLogger(__name__)


def run_pipeline(skip_shap: bool = False, eval_only: bool = False):
    start = datetime.now()
    logger.info("=" * 70)
    logger.info("PIPELINE MLOPS — DÉMARRAGE")
    logger.info(f"  Mode : {'eval_only' if eval_only else 'complet' + (' (sans SHAP)' if skip_shap else '')}")
    logger.info("=" * 70)

    results = {}

    # ── Étape 1 : Entraînement ───────────────────────────────────────────
    if not eval_only:
        logger.info("─── ÉTAPE 1/3 : Entraînement ───────────────────────────────────────")
        try:
            from ml.train import train
            metadata = train()
            results["train"] = {
                "status":   "success",
                "model":    metadata["model_name"],
                "version":  metadata["version"],
                "roc_auc":  metadata["test_metrics"]["roc_auc"],
                "run_id":   metadata.get("mlflow_run_id"),
            }
            logger.info(f"✓ Entraînement terminé — {metadata['model_name']} v{metadata['version']}")
        except Exception as e:
            logger.error(f"✗ Entraînement échoué: {e}")
            traceback.print_exc()
            results["train"] = {"status": "failed", "error": str(e)}
            sys.exit(1)

    # ── Étape 2 : Évaluation ─────────────────────────────────────────────
    logger.info("─── ÉTAPE 2/3 : Évaluation ──────────────────────────────────────────")
    try:
        from ml.evaluate import evaluate
        metrics = evaluate()
        results["evaluate"] = {
            "status":  "success",
            "roc_auc": metrics["technical_metrics"]["roc_auc"],
            "f1":      metrics["technical_metrics"]["f1"],
            "savings": metrics["business_metrics"]["estimated_savings"],
        }
        logger.info(f"✓ Évaluation terminée — ROC-AUC={metrics['technical_metrics']['roc_auc']:.4f}")
    except Exception as e:
        logger.error(f"✗ Évaluation échouée: {e}")
        traceback.print_exc()
        results["evaluate"] = {"status": "failed", "error": str(e)}

    # ── Étape 3 : Explicabilité SHAP ─────────────────────────────────────
    if not skip_shap:
        logger.info("─── ÉTAPE 3/3 : Explicabilité SHAP ─────────────────────────────────")
        try:
            from ml.explain import generate_shap_explanations
            insights = generate_shap_explanations()
            results["explain"] = {
                "status":       "success",
                "top_driver":   insights["top_drivers"][0]["feature"] if insights["top_drivers"] else "?",
                "n_explained":  insights.get("n_samples_explained"),
            }
            logger.info(f"✓ SHAP terminé — top driver: {results['explain']['top_driver']}")
        except Exception as e:
            logger.warning(f"⚠ SHAP non généré (non bloquant): {e}")
            results["explain"] = {"status": "skipped", "error": str(e)}
    else:
        logger.info("─── ÉTAPE 3/3 : SHAP ignoré (--skip-shap) ──────────────────────────")
        results["explain"] = {"status": "skipped"}

    # ── Rapport final ─────────────────────────────────────────────────────
    duration = (datetime.now() - start).total_seconds()
    success  = all(v.get("status") == "success" for v in results.values()
                   if v.get("status") != "skipped")

    print("\n" + "=" * 70)
    print("PIPELINE TERMINÉ")
    print("=" * 70)
    for step, info in results.items():
        icon = "✓" if info["status"] == "success" else ("⚠" if info["status"] == "skipped" else "✗")
        print(f"  {icon} {step.upper():10} → {info['status']}")
    print(f"\n  Durée totale : {duration:.1f}s")
    if not eval_only and "train" in results and results["train"].get("roc_auc"):
        print(f"  ROC-AUC      : {results['train']['roc_auc']:.4f}")
    print("=" * 70)

    return results, success


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pipeline MLOps HR Turnover")
    parser.add_argument("--skip-shap",  action="store_true", help="Ignorer la génération SHAP")
    parser.add_argument("--eval-only",  action="store_true", help="Évaluation uniquement (pas de réentraînement)")
    args = parser.parse_args()

    results, ok = run_pipeline(skip_shap=args.skip_shap, eval_only=args.eval_only)
    sys.exit(0 if ok else 1)