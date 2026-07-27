"""
app/services/chat_service.py
─────────────────────────────────────────────────────────────────────────────
Deux modes selon le contenu de contexte_rh :

  Mode A — données pré-calculées (depuis AnalyseSHAP) :
    contexte_rh contient _prediction, _shap, _survival déjà calculés.
    → Le backend les utilise tels quels, sans recalculer. 100% cohérent.

  Mode B — ID seul (chat autonome) :
    contexte_rh contient employee_number.
    → Le backend résout via le CSV + calcule predict/explain/survival.
"""

import re
import logging
import concurrent.futures

from huggingface_hub import InferenceClient
from app.config.settings import settings
from app.schemas.employe import ChatRequest, EmployeData
from app.services import model_service, shap_service, survival_service

logger = logging.getLogger(__name__)

client_ia = InferenceClient(
    model="meta-llama/Meta-Llama-3-8B-Instruct",
    token=settings.HF_TOKEN
)

# ── Traductions FR features SHAP ──────────────────────────────────────────────
# Synchronisé avec FEATURE_FR de src/pages/Analyseshap.tsx — NE PAS laisser diverger.
# (À terme : factoriser dans une ressource partagée, ex. exposée via /api/dictionnaire,
# pour éviter que front et back ne réintroduisent cet écart en cas de modification.)
FEATURE_FR: dict[str, str] = {
    "MonthlyIncome":            "Salaire mensuel",
    "Age":                      "Âge",
    "OverTime":                 "Heures supplémentaires",
    "JobSatisfaction":          "Satisfaction au travail",
    "DistanceFromHome":         "Distance domicile–travail",
    "YearsAtCompany":           "Ancienneté dans l'entreprise",
    "TotalWorkingYears":        "Expérience professionnelle totale",
    "NumCompaniesWorked":       "Nombre d'entreprises précédentes",
    "WorkLifeBalance":          "Équilibre vie pro / perso",
    "EnvironmentSatisfaction":  "Satisfaction de l'environnement",
    "StockOptionLevel":         "Niveau de stock-options",
    "JobLevel":                 "Niveau hiérarchique",
    "JobInvolvement":           "Implication dans le poste",
    "RelationshipSatisfaction": "Satisfaction des relations",
    "TrainingTimesLastYear":    "Formations suivies (an)",
    "YearsSinceLastPromotion":  "Années depuis la dernière promotion",
    "YearsWithCurrManager":     "Ancienneté avec le manager actuel",
    "YearsInCurrentRole":       "Années dans le rôle actuel",
    "PercentSalaryHike":        "Augmentation de salaire (%)",
    "MonthlyRate":              "Taux mensuel",
    "DailyRate":                "Taux journalier",
    "HourlyRate":                "Taux horaire",
    "SalaryPerYear":            "Salaire rapporté à l'ancienneté",
    "CareerStability":          "Stabilité de carrière",
    "PromotionGap":             "Écart depuis la dernière promotion",
    "OvertimeRisk":             "Risque lié aux heures supp.",
    "WorkloadIndex":            "Indice de charge de travail",
    "SatRisk":                  "Risque de faible satisfaction",
    "Education":                "Niveau d'études",
    "JobRole":                  "Intitulé de poste",
    "Department":               "Département",
    "MaritalStatus":            "Situation matrimoniale",
    "BusinessTravel":           "Fréquence de déplacements",
    "EducationField":           "Domaine d'études",
    "Gender":                   "Genre",
    "PerformanceRating":        "Évaluation de performance",
    "OverTime_Yes":             "Heures supplémentaires : Oui",
    "OverTime_No":              "Heures supplémentaires : Non",
    "Gender_Male":               "Genre : Homme",
    "Gender_Female":             "Genre : Femme",
    "MaritalStatus_Single":      "Situation : Célibataire",
    "MaritalStatus_Married":     "Situation : Marié(e)",
    "MaritalStatus_Divorced":    "Situation : Divorcé(e)",
    "BusinessTravel_Travel_Frequently": "Déplacements : Fréquents",
    "BusinessTravel_Travel_Rarely":     "Déplacements : Rares",
    "BusinessTravel_Non-Travel":        "Déplacements : Aucun",
    "Department_Sales":                      "Département : Ventes",
    "Department_Research & Development":     "Département : R&D",
    "Department_Human Resources":            "Département : RH",
    "JobRole_Sales Executive":          "Poste : Commercial",
    "JobRole_Research Scientist":       "Poste : Chercheur",
    "JobRole_Laboratory Technician":    "Poste : Technicien labo",
    "JobRole_Manufacturing Director":   "Poste : Directeur prod.",
    "JobRole_Healthcare Representative": "Poste : Représentant santé",
    "JobRole_Manager":                  "Poste : Manager",
    "JobRole_Sales Representative":     "Poste : Représentant ventes",
    "JobRole_Research Director":        "Poste : Directeur recherche",
    "JobRole_Human Resources":          "Poste : Ressources humaines",
    "EducationField_Life Sciences":     "Formation : Sciences de la vie",
    "EducationField_Other":             "Formation : Autre",
    "EducationField_Medical":           "Formation : Médecine",
    "EducationField_Marketing":         "Formation : Marketing",
    "EducationField_Technical Degree":  "Formation : Technique",
    "EducationField_Human Resources":   "Formation : RH",
}

def _clean_feature_name(raw: str) -> str:
    clean = re.sub(r"^(num__|cat__|remainder__)", "", raw)
    if clean in FEATURE_FR:
        return FEATURE_FR[clean]
    base = next((k for k in FEATURE_FR if clean.startswith(k + "_") or clean == k), None)
    if base:
        suffix = clean[len(base) + 1:].replace("_", " ")
        return f"{FEATURE_FR[base]} : {suffix}" if suffix else FEATURE_FR[base]
    return clean.replace("_", " ")


# ── Détection message employé ─────────────────────────────────────────────────
_ANALYSIS_KEYWORDS = {
    "analyse", "analyser", "analysez", "risque", "turnover", "départ",
    "prédiction", "predict", "facteur", "shap", "survie", "rétention",
    "profil", "fiche", "rapport", "bilan", "employé", "employe",
}

def _is_employee_query(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in _ANALYSIS_KEYWORDS) and bool(re.search(r"\d+", text))


# ── Formatage du contexte en texte pour le LLM ───────────────────────────────
def _format_context(pred: dict, shap: dict, surv: dict | None,
                    employee_info: dict | None = None) -> str:
    """
    Formate les résultats predict/explain/survival en bloc texte structuré.
    Utilise exactement les mêmes valeurs que l'interface — pas d'arrondi supplémentaire.
    """
    niveau    = pred.get("niveau_risque", "inconnu").upper()
    proba_pct = round(pred.get("probabilite", 0) * 100, 1)
    decision  = "Départ prédit" if pred.get("prediction_binaire", 0) == 1 else "Rétention prédite"

    contributions = shap.get("contributions", [])
    augmentent = [c for c in contributions if c["direction"] == "augmente"][:5]
    diminuent  = [c for c in contributions if c["direction"] == "diminue"][:3]

    shap_risk = "\n".join(
        f"  • {_clean_feature_name(c['feature'])} (impact : +{c['shap_value']:.3f})"
        for c in augmentent
    ) or "  • Aucun facteur significatif"

    shap_prot = "\n".join(
        f"  • {_clean_feature_name(c['feature'])} (impact : {c['shap_value']:.3f})"
        for c in diminuent
    ) or "  • Aucun facteur protecteur"

    if surv and surv.get("survival_disponible"):
        survie_bloc = (
            f"  Date estimée de départ  : {surv.get('date_estimee', 'N/A')}\n"
            f"  Délai médian estimé     : {surv.get('delai_mois', 'N/A')} mois\n"
            f"  Urgence                 : {surv.get('fiabilite_label', 'N/A')}"
        )
    else:
        survie_bloc = "  Non disponible."

    if niveau == "ÉLEVÉ":
        reco = "Action prioritaire requise — engager sans délai un entretien de rétention."
    elif niveau == "MOYEN":
        reco = "Suivi rapproché recommandé — planifier un point individuel prochainement."
    else:
        reco = "Maintenir la vigilance — risque faible, suivi régulier suffisant."

    emp_bloc = ""
    if employee_info:
        emp_bloc = (
            f"\nPROFIL EMPLOYÉ\n"
            f"  Poste        : {employee_info.get('_poste', 'N/A')}\n"
            f"  Département  : {employee_info.get('_departement', 'N/A')}\n"
            f"  Ancienneté   : {employee_info.get('_anciennete', 'N/A')} ans\n"
        )

    return f"""
═══════════════════════════════════════════════════════
ANALYSE TEMPS RÉEL — DONNÉES IDENTIQUES À L'INTERFACE
═══════════════════════════════════════════════════════
{emp_bloc}
PRÉDICTION DE TURNOVER
  Résultat         : {decision}
  Probabilité      : {proba_pct}%
  Niveau de risque : {niveau}

FACTEURS QUI AUGMENTENT LE RISQUE (SHAP)
{shap_risk}

FACTEURS PROTECTEURS (SHAP)
{shap_prot}

ANALYSE DE SURVIE
{survie_bloc}

RECOMMANDATION RH
  {reco}
═══════════════════════════════════════════════════════
""".strip()


# ── Calcul depuis EmployeData (Mode B — ID seul) ──────────────────────────────
def _compute_from_employee_data(data: EmployeData) -> tuple[dict, dict, dict | None]:
    """Appels parallèles predict + explain + survival."""
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        fut_pred = pool.submit(model_service.predict, data)
        fut_shap = pool.submit(shap_service.explain,  data)
        fut_surv = pool.submit(survival_service.compute_survival, data)
        return fut_pred.result(), fut_shap.result(), fut_surv.result()


# ── Prompts système ───────────────────────────────────────────────────────────
SYSTEM_PROMPT = """Tu es un assistant expert en ressources humaines et en analyse de données RH.
Tu aides les responsables RH et DRH à comprendre les prédictions de turnover des employés
et à prendre des décisions éclairées pour améliorer la rétention.

Tu peux :
- Expliquer les prédictions du modèle de machine learning
- Analyser les facteurs de risque de turnover
- Proposer des recommandations RH concrètes et actionnables
- Résumer les tendances observées dans les données
- Répondre aux questions sur le dataset IBM HR Analytics

Réponds toujours en français, de manière professionnelle, concise et actionnable.
Ne mentionne jamais que tu es une IA ou un robot. Tu es un assistant analytique RH."""

SYSTEM_PROMPT_EMPLOYEE = SYSTEM_PROMPT + """

Un contexte d'analyse employé t'est fourni. RÈGLES ABSOLUES :
- Utilise UNIQUEMENT les chiffres du contexte — ne les modifie pas, ne les arrondis pas.
- Si la probabilité est 67.3%, dis "67.3%", pas "environ 70%".
- Structure : 1) Synthèse du risque avec les chiffres exacts, 2) Facteurs clés nommés,
  3) Recommandations concrètes et actionnables.
- Ne recopie pas le bloc de données brutes — reformule de façon naturelle."""


# ── Point d'entrée ────────────────────────────────────────────────────────────
def chat(request: ChatRequest) -> dict:
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    last_user_msg = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
    )

    system_prompt = SYSTEM_PROMPT
    employee_ctx  = ""

    ctx = request.contexte_rh or {}

    # ── Mode A : données pré-calculées depuis AnalyseSHAP ─────────────────
    if "_prediction" in ctx and "_shap" in ctx:
        try:
            pred = ctx["_prediction"]
            shap = ctx["_shap"]
            surv = ctx.get("_survival")
            employee_ctx  = _format_context(pred, shap, surv, ctx)
            system_prompt = SYSTEM_PROMPT_EMPLOYEE
            logger.info("Mode A — données pré-calculées utilisées")
        except Exception as e:
            logger.warning(f"Mode A échoué : {e}")

    # ── Mode B : ID seul → recalcul depuis EmployeData ────────────────────
    elif _is_employee_query(last_user_msg) and "Age" in ctx:
        try:
            emp_data     = EmployeData(**{k: v for k, v in ctx.items() if not k.startswith("_")})
            pred, shap, surv = _compute_from_employee_data(emp_data)
            employee_ctx  = _format_context(pred, shap, surv, ctx)
            system_prompt = SYSTEM_PROMPT_EMPLOYEE
            logger.info("Mode B — recalcul depuis EmployeData")
        except Exception as e:
            logger.warning(f"Mode B échoué : {e}")

    # ── Injection du contexte dans le dernier message ─────────────────────
    full_messages = [{"role": "system", "content": system_prompt}]
    for i, msg in enumerate(messages):
        if msg["role"] == "user" and i == len(messages) - 1 and employee_ctx:
            full_messages.append({
                "role":    "user",
                "content": f"{msg['content']}\n\n[DONNÉES ANALYTIQUES]\n{employee_ctx}",
            })
        else:
            full_messages.append(msg)

    response = client_ia.chat.completions.create(
        messages=full_messages,
        max_tokens=1024,
    )

    return {
        "reponse":          response.choices[0].message.content,
        "tokens_utilises":  response.usage.completion_tokens,
        "mode":             "precomputed" if "_prediction" in ctx else ("employee" if employee_ctx else "general"),
    }