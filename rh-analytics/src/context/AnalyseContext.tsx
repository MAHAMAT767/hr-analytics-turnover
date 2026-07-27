// src/context/AnalyseContext.tsx
// Store partagé entre AnalyseSHAP et Assistant.
// AnalyseSHAP écrit les résultats → Assistant les lit directement.

import { createContext, useContext, useState, ReactNode } from 'react';

export interface AnalyseState {
  employeeNumber: number | null;
  employee:       any | null;   // ligne brute du dataset
  prediction:     any | null;   // réponse /api/predict
  shap:           any | null;   // réponse /api/explain
  survival:       any | null;   // réponse /api/survival
}

interface AnalyseContextType {
  analyse:    AnalyseState;
  setAnalyse: (s: AnalyseState) => void;
  clearAnalyse: () => void;
}

const EMPTY: AnalyseState = {
  employeeNumber: null,
  employee:       null,
  prediction:     null,
  shap:           null,
  survival:       null,
};

const AnalyseContext = createContext<AnalyseContextType>({
  analyse:      EMPTY,
  setAnalyse:   () => {},
  clearAnalyse: () => {},
});

export function AnalyseProvider({ children }: { children: ReactNode }) {
  const [analyse, setAnalyseState] = useState<AnalyseState>(EMPTY);

  const setAnalyse   = (s: AnalyseState) => setAnalyseState(s);
  const clearAnalyse = ()                => setAnalyseState(EMPTY);

  return (
    <AnalyseContext.Provider value={{ analyse, setAnalyse, clearAnalyse }}>
      {children}
    </AnalyseContext.Provider>
  );
}

export const useAnalyse = () => useContext(AnalyseContext);