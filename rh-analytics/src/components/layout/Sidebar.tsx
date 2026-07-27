// src/components/layout/Sidebar.tsx
// Navigation réduite à 4 entrées pour la soutenance.
// Structure, style et footer conservés à l'identique.

import { NavLink } from 'react-router-dom';
import {
  DashboardIcon, ScoreIcon, ChatIcon, SettingsIcon,
  ChartBarsIcon,
} from '../ui/Icons';

const SECTIONS = [
  {
    label: 'VUE GLOBALE',
    items: [
      { to: '/dashboard',      label: 'Tableau de bord',  Icon: DashboardIcon },
      { to: '/profils-risque', label: 'Profils à risque', Icon: ChartBarsIcon },
    ],
  },
  {
    label: 'ANALYSE IA',
    items: [
      { to: '/analyse-shap', label: 'Scoring Client', Icon: ScoreIcon },
    ],
  },
  {
    label: 'OUTILS',
    items: [
      { to: '/assistant',    label: 'Assistant RH IA', Icon: ChatIcon        },
      { to: '/parametres',   label: 'Paramètres',      Icon: SettingsIcon    },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      minHeight: '100vh',
      background: 'var(--card)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0, top: 0,
      zIndex: 100,
      transition: 'width 0.2s ease',
    }}>

      {/* Logo — identique à l'original */}
      <div style={{
        padding: '1.1rem 1.2rem 1rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32,
          background: 'var(--primary)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ChartBarsIcon size={16} color="#fff" strokeWidth={1.9} />
        </div>
        <div>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 700,
            color: 'var(--text)', letterSpacing: '-0.02em',
          }}>
            HR Analytics
          </p>
          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            WORKFORCE INTELLIGENCE
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0.875rem 0.75rem', overflowY: 'auto' }}>
        {SECTIONS.map(({ label, items }) => (
          <div key={label} style={{ marginBottom: '1.25rem' }}>
            <p style={{
              margin: '0 0 0.35rem 0.5rem',
              fontSize: 9, fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              {label}
            </p>
            {items.map(({ to, label: l, Icon }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--primary-light)' : 'var(--text-sub)',
                  background: isActive ? 'var(--primary-bg)' : 'transparent',
                  marginBottom: 1,
                  transition: 'all 0.12s ease',
                  borderLeft: isActive ? '2px solid var(--primary-light)' : '2px solid transparent',
                })}
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    <Icon size={14} strokeWidth={isActive ? 2 : 1.75} />
                    <span style={{ flex: 1 }}>{l}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer — identique à l'original */}
      <div style={{
        padding: '0.875rem 1.2rem',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{
          background: 'var(--bg-subtle)',
          borderRadius: 7,
          padding: '0.625rem 0.75rem',
        }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: 'var(--text-sub)' }}>
            IBM HR Analytics
          </p>
          <p style={{ margin: '1px 0 0', fontSize: 9, color: 'var(--text-muted)' }}>
            Mahamat Haroun Ibrahim · 2026
          </p>
        </div>
      </div>
    </aside>
  );
}