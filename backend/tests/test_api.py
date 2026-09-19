"""
tests/test_api.py — Tests de l'API FastAPI et du pipeline ML
"""

import pytest
import numpy as np
import pandas as pd
from pathlib import Path
from unittest.mock import patch, MagicMock


# ── Fixtures ──────────────────────────────────────────────────────────────────
@pytest.fixture
def sample_employe():
    return {
        "Age": 35,
        "MonthlyIncome": 5000,
        "JobSatisfaction": 3,
        "OverTime": 0,
        "DistanceFromHome": 10,
        "YearsAtCompany": 5,
        "WorkLifeBalance": 3,
        "EnvironmentSatisfaction": 3,
        "NumCompaniesWorked": 2,
        "TotalWorkingYears": 10,
        "Department": "Research & Development",
        "JobRole": "Research Scientist",
        "MaritalStatus": "Married",
        "BusinessTravel": "Travel_Rarely",
        "EducationField": "Life Sciences",
        "Gender": 1,
        "Education": 3,
        "JobLevel": 2,
        "StockOptionLevel": 1,
        "JobInvolvement": 3,
        "PerformanceRating": 3,
        "RelationshipSatisfaction": 3,
        "TrainingTimesLastYear": 3,
        "YearsInCurrentRole": 4,
        "YearsSinceLastPromotion": 1,
        "YearsWithCurrManager": 3,
        "PercentSalaryHike": 14,
        "MonthlyRate": 14313,
        "DailyRate": 802,
        "HourlyRate": 66,
    }


@pytest.fixture
def sample_dataframe():
    """DataFrame de test avec quelques employés."""
    data = {
        "Age": [25, 45, 35, 28, 52],
        "MonthlyIncome": [3000, 8000, 5000, 2500, 12000],
        "JobSatisfaction": [2, 4, 3, 1, 4],
        "YearsAtCompany": [1, 10, 5, 2, 15],
        "OverTime": ["Yes", "No", "No", "Yes", "No"],
        "WorkLifeBalance": [2, 4, 3, 1, 4],
        "TotalWorkingYears": [3, 20, 10, 4, 25],
        "YearsSinceLastPromotion": [1, 3, 2, 1, 5],
    }
    return pd.DataFrame(data)


# ── Tests du feature engineering ─────────────────────────────────────────────
class TestFeatureEngineering:

    def test_build_features_basic(self, sample_dataframe):
        """Vérifie que build_features crée les colonnes attendues."""
        import sys
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from ml.train import build_features

        result = build_features(sample_dataframe)

        assert "SalaryPerYear" in result.columns
        assert "CareerStability" in result.columns
        assert "PromotionGap" in result.columns
        assert "OvertimeRisk" in result.columns
        assert "WorkloadIndex" in result.columns

    def test_build_features_no_inf(self, sample_dataframe):
        """Vérifie l'absence de valeurs infinies."""
        from ml.train import build_features
        result = build_features(sample_dataframe)
        num_cols = result.select_dtypes(include=[np.number]).columns
        assert not np.isinf(result[num_cols].values).any(), "Valeurs infinies détectées"

    def test_build_features_no_nan(self, sample_dataframe):
        """Vérifie l'absence de NaN."""
        from ml.train import build_features
        result = build_features(sample_dataframe)
        assert not result.isnull().any().any(), "NaN détectés"

    def test_overtime_risk_calculation(self):
        """OvertimeRisk = 1 seulement si OverTime=Yes ET WorkLifeBalance<=2."""
        from ml.train import build_features
        df = pd.DataFrame({
            "OverTime": ["Yes", "Yes", "No", "No"],
            "WorkLifeBalance": [1, 3, 1, 3],
            "JobSatisfaction": [3, 3, 3, 3],
            "MonthlyIncome": [3000, 3000, 3000, 3000],
            "YearsAtCompany": [2, 2, 2, 2],
            "TotalWorkingYears": [5, 5, 5, 5],
            "YearsSinceLastPromotion": [1, 1, 1, 1],
        })
        result = build_features(df)
        expected = [1, 0, 0, 0]
        assert list(result["OvertimeRisk"]) == expected


# ── Tests du modèle service ───────────────────────────────────────────────────
class TestModelService:

    def test_employe_to_dataframe_shape(self, sample_employe):
        """Vérifie que la conversion produit un DataFrame 1 ligne."""
        from app.schemas.employe import EmployeData
        from app.services.model_service import employe_to_dataframe
        data = EmployeData(**sample_employe)
        df   = employe_to_dataframe(data)
        assert df.shape[0] == 1, "Le DataFrame doit avoir exactement 1 ligne"

    def test_employe_overtime_conversion(self, sample_employe):
        """Vérifie que OverTime int → str est correct."""
        from app.schemas.employe import EmployeData
        from app.services.model_service import employe_to_dataframe

        sample_employe["OverTime"] = 1
        df = employe_to_dataframe(EmployeData(**sample_employe))
        assert df["OverTime"].iloc[0] == "Yes"

        sample_employe["OverTime"] = 0
        df = employe_to_dataframe(EmployeData(**sample_employe))
        assert df["OverTime"].iloc[0] == "No"

    def test_predict_returns_required_fields(self, sample_employe):
        """Vérifie les champs de la réponse de prédiction."""
        from app.schemas.employe import EmployeData
        from app.services import model_service

        # Mock du pipeline
        mock_pipeline = MagicMock()
        mock_pipeline.predict_proba.return_value = np.array([[0.7, 0.3]])

        with patch.object(model_service, "pipeline", mock_pipeline):
            data   = EmployeData(**sample_employe)
            result = model_service.predict(data)

        required_fields = ["probabilite", "niveau_risque", "pourcentage", "prediction"]
        for field in required_fields:
            assert field in result, f"Champ manquant: {field}"

    def test_predict_without_model(self, sample_employe):
        """Vérifie la gestion du cas sans modèle."""
        from app.schemas.employe import EmployeData
        from app.services import model_service

        with patch.object(model_service, "pipeline", None):
            result = model_service.predict(EmployeData(**sample_employe))
        assert "erreur" in result

    def test_risk_levels(self, sample_employe):
        """Vérifie la classification des niveaux de risque."""
        from app.schemas.employe import EmployeData
        from app.services import model_service

        mock_pipeline = MagicMock()

        for proba, expected_level in [(0.10, "faible"), (0.35, "moyen"), (0.60, "élevé")]:
            mock_pipeline.predict_proba.return_value = np.array([[1 - proba, proba]])
            with patch.object(model_service, "pipeline", mock_pipeline):
                result = model_service.predict(EmployeData(**sample_employe))
            assert result["niveau_risque"] == expected_level, \
                f"Proba {proba} devrait donner '{expected_level}', got '{result['niveau_risque']}'"


# ── Tests du drift detector ───────────────────────────────────────────────────
class TestDriftDetector:

    def test_psi_stable(self):
        """PSI proche de 0 pour deux distributions identiques."""
        from ml.monitoring.drift_detector import compute_psi
        data = np.random.normal(0, 1, 1000)
        psi  = compute_psi(data, data + np.random.normal(0, 0.01, 1000))
        assert psi < 0.10, f"PSI devrait être stable: {psi}"

    def test_psi_drifted(self):
        """PSI élevé pour deux distributions très différentes."""
        from ml.monitoring.drift_detector import compute_psi
        ref  = np.random.normal(0, 1, 1000)
        prod = np.random.normal(5, 1, 1000)  # Distribution décalée
        psi  = compute_psi(ref, prod)
        assert psi > 0.25, f"PSI devrait indiquer un drift: {psi}"

    def test_interpret_psi(self):
        from ml.monitoring.drift_detector import interpret_psi
        assert interpret_psi(0.05) == "stable"
        assert interpret_psi(0.15) == "changement_modere"
        assert interpret_psi(0.30) == "drift_significatif"

    def test_ks_test_identical(self):
        """KS-test ne détecte pas de drift pour distributions identiques."""
        from ml.monitoring.drift_detector import ks_test
        data   = np.random.normal(0, 1, 500)
        result = ks_test(data, data + np.random.normal(0, 0.001, 500))
        # p-value élevée → pas de drift
        assert result["pvalue"] >= 0.01

    def test_feature_drift_report_structure(self, sample_dataframe):
        """Vérifie la structure du rapport de drift."""
        from ml.monitoring.drift_detector import detect_feature_drift
        num_cols = ["Age", "MonthlyIncome", "YearsAtCompany"]
        report   = detect_feature_drift(sample_dataframe, sample_dataframe, num_cols=num_cols)

        assert "summary"     in report
        assert "features"    in report
        assert "timestamp"   in report
        assert "drifted_features" in report["summary"]
        assert "drift_rate"       in report["summary"]


# ── Tests de l'API FastAPI ────────────────────────────────────────────────────
class TestAPI:

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from app.main import app
        return TestClient(app)

    def test_health_endpoint(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_predict_endpoint_structure(self, client, sample_employe):
        """Vérifie que /predict retourne les bons champs.

        Le pipeline est mocké : model.pkl est un artefact non versionné, absent
        d'un clone neuf et du runner CI. On teste ici le contrat de l'endpoint,
        pas la qualité du modèle (couverte par la quality gate du pipeline ML).
        """
        from app.services import model_service

        mock_pipeline = MagicMock()
        mock_pipeline.predict_proba.return_value = np.array([[0.7, 0.3]])

        with patch.object(model_service, "pipeline", mock_pipeline):
            response = client.post("/api/predict", json=sample_employe)

        assert response.status_code == 200
        data = response.json()
        assert "probabilite"  in data
        assert "niveau_risque" in data

    def test_stats_endpoint(self, client):
        response = client.get("/api/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_employes"  in data
        assert "taux_turnover"   in data