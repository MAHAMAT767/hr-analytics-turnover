"""
app/api/routes/chat.py
─────────────────────────────────────────────────────────────────────────────
Route POST /api/chat — Chatbot RH enrichi.

Nouveauté : le frontend peut passer `employee_data` (les champs EmployeData
de l'employé actuellement consulté). Quand l'utilisateur pose une question
sur un employé précis, le service récupère predict + explain + survival
et les injecte comme contexte dans le LLM.
"""

import re
import logging
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException

from app.schemas.employe import ChatRequest, EmployeData
from app.services import chat_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["4. Chat IA"])


# ── Chargement du dataset (pour recherche par EmployeeNumber) ─────────────────
_dataset: Optional[list[dict]] = None

def _get_dataset() -> list[dict]:
    """Charge le dataset CSV une seule fois en mémoire."""
    global _dataset
    if _dataset is None:
        try:
            from app.config.settings import settings
            from pathlib import Path
            csv_path = Path(settings.DATA_PATH) if hasattr(settings, "DATA_PATH") \
                       else Path("data/WA_Fn-UseC_-HR-Employee-Attrition.csv")
            if csv_path.exists():
                df = pd.read_csv(csv_path)
                _dataset = df.to_dict(orient="records")
                logger.info(f"Dataset chargé : {len(_dataset)} employés")
            else:
                _dataset = []
                logger.warning(f"Dataset introuvable : {csv_path}")
        except Exception as e:
            _dataset = []
            logger.warning(f"Impossible de charger le dataset : {e}")
    return _dataset


def _row_to_employe_data(row: dict) -> dict:
    """Convertit une ligne du CSV en dict compatible EmployeData."""
    return {
        "Age":                      int(row.get("Age", 35)),
        "MonthlyIncome":            float(row.get("MonthlyIncome", 5000)),
        "JobSatisfaction":          int(row.get("JobSatisfaction", 3)),
        "OverTime":                 1 if str(row.get("OverTime", "No")) == "Yes" else 0,
        "DistanceFromHome":         int(row.get("DistanceFromHome", 10)),
        "YearsAtCompany":           int(row.get("YearsAtCompany", 5)),
        "WorkLifeBalance":          int(row.get("WorkLifeBalance", 3)),
        "EnvironmentSatisfaction":  int(row.get("EnvironmentSatisfaction", 3)),
        "NumCompaniesWorked":       int(row.get("NumCompaniesWorked", 2)),
        "TotalWorkingYears":        int(row.get("TotalWorkingYears", 8)),
        "Department":               str(row.get("Department", "Research & Development")),
        "JobRole":                  str(row.get("JobRole", "Sales Executive")),
        "MaritalStatus":            str(row.get("MaritalStatus", "Married")),
        "BusinessTravel":           str(row.get("BusinessTravel", "Travel_Rarely")),
        "EducationField":           str(row.get("EducationField", "Life Sciences")),
        "Gender":                   1 if str(row.get("Gender", "Male")) == "Male" else 0,
        "Education":                int(row.get("Education", 3)),
        "JobLevel":                 int(row.get("JobLevel", 2)),
        "StockOptionLevel":         int(row.get("StockOptionLevel", 1)),
        "JobInvolvement":           int(row.get("JobInvolvement", 3)),
        "PerformanceRating":        int(row.get("PerformanceRating", 3)),
        "RelationshipSatisfaction": int(row.get("RelationshipSatisfaction", 3)),
        "TrainingTimesLastYear":    int(row.get("TrainingTimesLastYear", 3)),
        "YearsInCurrentRole":       int(row.get("YearsInCurrentRole", 4)),
        "YearsSinceLastPromotion":  int(row.get("YearsSinceLastPromotion", 1)),
        "YearsWithCurrManager":     int(row.get("YearsWithCurrManager", 3)),
        "PercentSalaryHike":        int(row.get("PercentSalaryHike", 14)),
        "MonthlyRate":              float(row.get("MonthlyRate", 14313)),
        "DailyRate":                float(row.get("DailyRate", 802)),
        "HourlyRate":               float(row.get("HourlyRate", 66)),
    }


def _resolve_employee_context(request: ChatRequest) -> ChatRequest:
    """
    Si `contexte_rh` contient un `employee_number` mais pas les champs EmployeData,
    on recherche l'employé dans le dataset et on complète le contexte.
    """
    if not request.contexte_rh:
        return request

    ctx = request.contexte_rh

    # Cas 0 : Mode A — données déjà précalculées (depuis AnalyseSHAP).
    # On ne doit JAMAIS tenter de ré-enrichir ce contexte : un chiffre présent
    # dans le message de l'utilisateur (ex. "risque de 73 %") serait sinon
    # interprété comme un EmployeeNumber et écraserait _poste/_departement/
    # _anciennete avec les données d'un employé totalement différent.
    if "_prediction" in ctx and "_shap" in ctx:
        return request

    # Cas 1 : le contexte contient déjà les champs EmployeData (envoyés par le front)
    if "Age" in ctx and "MonthlyIncome" in ctx:
        return request

    # Cas 2 : le contexte contient seulement un employee_number → recherche dans le CSV
    emp_num = ctx.get("employee_number") or ctx.get("EmployeeNumber")
    if emp_num is None:
        # Tentative d'extraction depuis le dernier message utilisateur
        last_msg = next(
            (m.content for m in reversed(request.messages) if m.role == "user"), ""
        )
        m = re.search(r"\b(\d{1,4})\b", last_msg)
        if m:
            emp_num = int(m.group(1))

    if emp_num is not None:
        dataset = _get_dataset()
        row = next(
            (r for r in dataset if str(r.get("EmployeeNumber", "")) == str(emp_num)),
            None,
        )
        if row:
            enriched = dict(ctx)
            enriched.update(_row_to_employe_data(row))
            # Ajouter les infos d'affichage
            enriched["_poste"]       = str(row.get("JobRole", ""))
            enriched["_departement"] = str(row.get("Department", ""))
            enriched["_anciennete"]  = int(row.get("YearsAtCompany", 0))
            return ChatRequest(
                messages=request.messages,
                contexte_rh=enriched,
            )
        else:
            logger.warning(f"Employé n°{emp_num} introuvable dans le dataset")

    return request


@router.post("/chat")
def chat(request: ChatRequest):
    """
    Endpoint principal du chatbot RH.

    Le corps JSON accepte :
    {
      "messages": [...],
      "contexte_rh": {
        // Option A — champs complets (envoyés depuis AnalyseSHAP)
        "Age": 32, "MonthlyIncome": 5000, ...,

        // Option B — uniquement l'ID (le backend cherche dans le CSV)
        "employee_number": 42
      }
    }
    """
    try:
        # Résolution du contexte employé si nécessaire
        enriched_request = _resolve_employee_context(request)
        return chat_service.chat(enriched_request)
    except Exception as e:
        logger.exception("Erreur dans /api/chat")
        raise HTTPException(status_code=500, detail=str(e))