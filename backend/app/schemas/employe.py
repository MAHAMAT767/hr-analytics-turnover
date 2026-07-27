from pydantic import BaseModel
from typing import List, Optional, Any


class EmployeData(BaseModel):
    Age:                      int
    MonthlyIncome:            float
    JobSatisfaction:          int
    OverTime:                 int
    DistanceFromHome:         int
    YearsAtCompany:           int
    WorkLifeBalance:          int
    EnvironmentSatisfaction:  int
    NumCompaniesWorked:       int
    TotalWorkingYears:        int
    Department:               str   = "Research & Development"
    JobRole:                  str   = "Sales Executive"
    MaritalStatus:            str   = "Married"
    BusinessTravel:           str   = "Travel_Rarely"
    EducationField:           str   = "Life Sciences"
    Gender:                   int   = 1
    Education:                int   = 3
    JobLevel:                 int   = 2
    StockOptionLevel:         int   = 1
    JobInvolvement:           int   = 3
    PerformanceRating:        int   = 3
    RelationshipSatisfaction: int   = 3
    TrainingTimesLastYear:    int   = 3
    YearsInCurrentRole:       int   = 4
    YearsSinceLastPromotion:  int   = 1
    YearsWithCurrManager:     int   = 3
    PercentSalaryHike:        int   = 14
    MonthlyRate:              float = 14313
    DailyRate:                float = 802
    HourlyRate:               float = 66


class ChatMessage(BaseModel):
    role:    str
    content: str


class ChatRequest(BaseModel):
    messages:    List[ChatMessage]
    # Peut contenir :
    #   - les champs EmployeData complets (envoyés depuis AnalyseSHAP)
    #   - { "employee_number": 42 }  (le backend résout depuis le CSV)
    #   - None (question générale, pas d'analyse d'employé)
    contexte_rh: Optional[dict[str, Any]] = None