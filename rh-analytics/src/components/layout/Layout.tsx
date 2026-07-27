// src/components/layout/Layout.tsx
// Ajout de '/analyse-shap' dans TITLES, le reste est identique à l'original.

import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar  from './Topbar';

const TITLES: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':      { title: 'Tableau de bord',    subtitle: 'Vue exécutive — IBM HR Analytics Dataset' },
  '/profils-risque': { title: 'Profils à risque',   subtitle: 'Centre de surveillance — Employés à risque élevé de départ' },
  '/analyse-shap':   { title: 'Analyse SHAP',        subtitle: 'Prédiction individuelle & explicabilité par employé' },
  '/assistant':      { title: 'Assistant RH IA',     subtitle: 'Assistance analytique et recommandations RH' },
  '/parametres':     { title: 'Paramètres',          subtitle: 'Configuration de la plateforme' },
};

export default function Layout() {
  const { pathname } = useLocation();
  const meta = TITLES[pathname] || { title: 'HR Analytics', subtitle: '' };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--bg)',
    }}>
      <Sidebar />
      <div style={{
        marginLeft: 'var(--sidebar-w)',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        <Topbar title={meta.title} subtitle={meta.subtitle} />
        <main style={{
          flex: 1,
          padding: '1.5rem 1.75rem',
          overflowY: 'auto',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}