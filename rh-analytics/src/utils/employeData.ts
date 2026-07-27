// src/utils/employeData.ts
// Conversion d'une ligne brute du dataset (CSV) vers le format EmployeData
// attendu par /api/predict, /api/explain et /api/survival.
//
// Extrait de src/pages/Analyseshap.tsx pour être partagé avec
// src/hooks/useEmployeeAnalysis.ts (Analyseshap.tsx ET Assistant.tsx
// doivent produire exactement le même payload pour garantir des résultats
// identiques sur les deux pages).

export function toEmployeData(e: any): Record<string, any> {
  return {
    Age: Number(e.Age) || 35, MonthlyIncome: Number(e.MonthlyIncome) || 5000,
    JobSatisfaction: Number(e.JobSatisfaction) || 3, OverTime: e.OverTime === 'Yes' ? 1 : 0,
    DistanceFromHome: Number(e.DistanceFromHome) || 10, YearsAtCompany: Number(e.YearsAtCompany) || 5,
    WorkLifeBalance: Number(e.WorkLifeBalance) || 3, EnvironmentSatisfaction: Number(e.EnvironmentSatisfaction) || 3,
    NumCompaniesWorked: Number(e.NumCompaniesWorked) || 2, TotalWorkingYears: Number(e.TotalWorkingYears) || 8,
    Department: e.Department || 'Research & Development', JobRole: e.JobRole || 'Sales Executive',
    MaritalStatus: e.MaritalStatus || 'Married', BusinessTravel: e.BusinessTravel || 'Travel_Rarely',
    EducationField: e.EducationField || 'Life Sciences', Gender: e.Gender === 'Male' ? 1 : 0,
    Education: Number(e.Education) || 3, JobLevel: Number(e.JobLevel) || 2,
    StockOptionLevel: Number(e.StockOptionLevel) || 1, JobInvolvement: Number(e.JobInvolvement) || 3,
    PerformanceRating: Number(e.PerformanceRating) || 3, RelationshipSatisfaction: Number(e.RelationshipSatisfaction) || 3,
    TrainingTimesLastYear: Number(e.TrainingTimesLastYear) || 3, YearsInCurrentRole: Number(e.YearsInCurrentRole) || 4,
    YearsSinceLastPromotion: Number(e.YearsSinceLastPromotion) || 1, YearsWithCurrManager: Number(e.YearsWithCurrManager) || 3,
    PercentSalaryHike: Number(e.PercentSalaryHike) || 14, MonthlyRate: Number(e.MonthlyRate) || 14313,
    DailyRate: Number(e.DailyRate) || 802, HourlyRate: Number(e.HourlyRate) || 66,
  };
}