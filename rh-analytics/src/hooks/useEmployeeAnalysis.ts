// src/hooks/useEmployeeAnalysis.ts
// Analyse d'un employé (recherche dans le dataset + predict + explain + survival),
// partagée entre Analyseshap.tsx et Assistant.tsx.
//
// Les deux pages doivent passer par ce hook : c'est ce qui garantit des chiffres
// identiques de part et d'autre, et un contexte déjà précalculé (Mode A) envoyé au
// backend plutôt qu'un simple employee_number qu'il recalculerait de son côté.

import { useRef, useCallback } from 'react';
import { getDataset, predict, explain, survival } from '../api/client';
import { toEmployeData } from '../utils/employeData';
import { useAnalyse, AnalyseState } from '../context/AnalyseContext';

export interface EmployeeAnalysisResult {
  employee:   any;
  prediction: any;
  shap:       any;
  survival:   any | null;
}

export function useEmployeeAnalysis() {
  const datasetCache = useRef<any[] | null>(null);
  const { setAnalyse } = useAnalyse();

  /**
   * Recherche l'employé dans le dataset (mis en cache après le premier appel)
   * puis lance predict + explain + survival en parallèle.
   * Met à jour AnalyseContext au passage (→ EmployeePanel s'affiche partout).
   * Lève une erreur si l'employé n'existe pas dans le dataset.
   */
  const analyzeEmployee = useCallback(async (employeeNumber: number | string): Promise<EmployeeAnalysisResult> => {
    if (!datasetCache.current) {
      const res = await getDataset();
      datasetCache.current = res.data?.employes ?? [];
    }
    const employees = datasetCache.current ?? [];
    const emp = employees.find((e: any) => String(e.EmployeeNumber) === String(employeeNumber));
    if (!emp) {
      throw new Error(`Pas d'employé avec le numéro ${employeeNumber} dans le dataset.`);
    }

    const payload = toEmployeData(emp);
    const [predRes, expRes, survRes] = await Promise.all([
      predict(payload),
      explain(payload),
      survival(payload).catch((err) => {
        console.warn('Analyse de survie indisponible :', err?.message ?? err);
        return { data: null };
      }),
    ]);

    const result: EmployeeAnalysisResult = {
      employee:   emp,
      prediction: predRes.data,
      shap:       expRes.data,
      survival:   survRes.data ?? null,
    };

    const newState: AnalyseState = {
      employeeNumber: Number(employeeNumber),
      employee:       result.employee,
      prediction:     result.prediction,
      shap:           result.shap,
      survival:       result.survival,
    };
    setAnalyse(newState);

    return result;
  }, [setAnalyse]);

  return { analyzeEmployee, datasetCache };
}