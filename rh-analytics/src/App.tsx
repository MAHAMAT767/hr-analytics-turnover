// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout      from './components/layout/Layout';
import Dashboard   from './pages/Dashboard';
import AnalyseSHAP from './pages/Analyseshap';
import Assistant   from './pages/Assistant';
import Parametres  from './pages/Parametres';
import ProfilsRisque  from './pages/ProfilsRisque';
import { AnalyseProvider } from './context/AnalyseContext';

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AnalyseProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/"               element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"      element={<Dashboard />}   />
              <Route path="/profils-risque" element={<ProfilsRisque />} />
              <Route path="/scoringclient"  element={<AnalyseSHAP />} />
              <Route path="/assistant"      element={<Assistant />}   />
              <Route path="/parametres"     element={<Parametres />}  />
              <Route path="/employes"       element={<Navigate to="/dashboard"     replace />} />
              <Route path="/analytics"      element={<Navigate to="/dashboard"     replace />} />
              <Route path="/analyse-shap"   element={<Navigate to="/scoringclient" replace />} />
              <Route path="/prediction"     element={<Navigate to="/scoringclient" replace />} />
              <Route path="/facteurs"       element={<Navigate to="/scoringclient" replace />} />
              <Route path="/explicabilite"  element={<Navigate to="/scoringclient" replace />} />
              <Route path="/simulateur"     element={<Navigate to="/scoringclient" replace />} />
              <Route path="/dictionnaire"   element={<Navigate to="/dashboard"     replace />} />
              <Route path="*"               element={<Navigate to="/dashboard"     replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AnalyseProvider>
    </QueryClientProvider>
  );
}