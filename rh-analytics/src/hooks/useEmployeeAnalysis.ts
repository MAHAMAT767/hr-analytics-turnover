// src/hooks/useEmployeeAnalysis.ts
// Logique d'analyse d'un employé (recherche dans le dataset + predict + explain
// + survival), partagée entre src/pages/Analyseshap.tsx et src/pages/Assistant.tsx.
//
// Pourquoi ce hook : avant, Analyseshap.tsx était la SEULE page à calculer
// predict/explain/survival. Assistant.tsx se contentait d'envoyer un
// `employee_number` au backend, qui recalculait de son côté (Mode B) puis
// laissait le LLM reformuler les chiffres en texte libre — sans jamais
// afficher la jauge, les facteurs SHAP ou la date de survie dans le chat.
//
// Avec ce hook, Assistant.tsx peut effectuer EXACTEMENT le même calcul que
// Analyseshap.tsx, mettre à jour le même AnalyseContext (donc afficher le
// même panneau employé dans sa sidebar), et envoyer au backend un contexte
// déjà précalculé (Mode A) — garantissant des chiffres identiques aux deux
// endroits.

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