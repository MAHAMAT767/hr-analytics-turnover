from fastapi import APIRouter
from app.schemas.employe import EmployeData
from app.services import model_service, shap_service, survival_service

router = APIRouter(prefix="/api", tags=["1. Prédiction"])


@router.post("/predict")
def predict(data: EmployeData):
    return model_service.predict(data)


@router.get("/feature-importance")
def feature_importance():
    return model_service.feature_importance()


@router.post("/explain")
def explain(data: EmployeData):
    return shap_service.explain(data)


@router.post("/survival")
def survival(data: EmployeData):
    """
    Analyse de survie : estime la date probable de départ de l'employé.
    Retourne la courbe de survie S(t), le délai médian et l'intervalle de confiance.
    """
    return survival_service.compute_survival(data)