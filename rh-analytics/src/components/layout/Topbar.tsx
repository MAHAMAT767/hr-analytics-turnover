import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SunIcon, MoonIcon, BellIcon, SearchIcon, ChevronDownIcon, CloseIcon, WifiIcon, WifiOffIcon } from '../ui/Icons';
import { useTheme } from '../../context/ThemeContext';
import { useNetworkMonitor, NetworkEvent, NetworkStatus } from '../../hooks/useNetworkMonitor';

// ── Notifications statiques initiales ────────────────────────────────

const NOTIFS_INITIALES: NetworkEvent[] = [
  { id: 1, titre: '3 employés à risque élevé',  desc: "Sales · détecté aujourd'hui",    type: 'danger',  time: 'Il y a 2h', lu: false },
  { id: 2, titre: 'Taux de turnover en hausse',  desc: '+2.1% vs mois dernier',           type: 'warning', time: 'Il y a 5h', lu: false },
  { id: 3, titre: 'Rapport mensuel disponible',  desc: 'Mai 2026 · IBM HR Analytics',     type: 'info',    time: 'Il y a 1j', lu: true  },
  { id: 4, titre: 'Satisfaction R&D en baisse',  desc: 'Score moyen : 2.1/4',             type: 'warning', time: 'Il y a 2j', lu: true  },
];

const NOTIF_C: Record<string, string> = {
  danger:  'var(--danger)',
  warning: 'var(--warning)',
  info:    'var(--info)',
};

// ── Toast temps réel ──────────────────────────────────────────────────

interface ToastProps {
  event: NetworkEvent;
  onClose: () => void;
}

function NetworkToast({ event, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  const color = NOTIF_C[event.type] || 'var(--info)';

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      width: 320,
      background: 'var(--card)',
      border: `1px solid var(--border)`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 10,
      boxShadow: 'var(--shadow-lg)',
      padding: '0.875rem 1rem',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      animation: 'slideInRight 0.25s ease',
    }}>
      {/* Dot couleur */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, marginTop: 5, flexShrink: 0,
      }} />
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          {event.titre}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
          {event.desc}
        </p>
      </div>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}
      >
        <CloseIcon size={12} />
      </button>
    </div>
  );
}

// ── Indicateur statut réseau ──────────────────────────────────────────

interface NetworkBadgeProps {
  status: NetworkStatus | null;
}

function NetworkBadge({ status }: NetworkBadgeProps) {
  if (!status) return null;

  const color   = status.online ? 'var(--success)' : 'var(--danger)';
  const Icon    = status.online ? WifiIcon : WifiOffIcon;
  const label   = status.online
    ? status.latency_ms !== null ? `${status.latency_ms} ms` : 'En ligne'
    : 'Hors ligne';

  return (
    <div
      title={`Gateway : ${status.gateway} · Dernier check : ${status.last_check}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 9px',
        background: status.online ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.08)',
        border: `1px solid ${status.online ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.25)'}`,
        borderRadius: 6, fontSize: 11, fontWeight: 600,
        color, cursor: 'default', userSelect: 'none',
      }}
    >
      <Icon size={11} />
      {label}
    </div>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────

interface Props { title: string; subtitle?: string; }

export default function Topbar({ title, subtitle }: Props) {
  const { theme, toggle } = useTheme();
  const [searchVal,   setSearchVal]   = useState('');
  const [showNotifs,  setShowNotifs]  = useState(false);
  const [notifs,      setNotifs]      = useState<NetworkEvent[]>(NOTIFS_INITIALES);
  const [toast,       setToast]       = useState<NetworkEvent | null>(null);
  const [netStatus,   setNetStatus]   = useState<NetworkStatus | null>(null);

  // ── Callbacks stables pour le hook ──
  const handleEvents = useCallback((newEvents: NetworkEvent[]) => {
    setNotifs(prev => [...newEvents, ...prev].slice(0, 50)); // max 50 notifs
    // Affiche le toast pour le premier événement (le plus récent)
    if (newEvents.length > 0) {
      setToast(newEvents[0]);
    }
  }, []);

  const handleStatus = useCallback((status: NetworkStatus) => {
    setNetStatus(status);
  }, []);

  // ── Connexion WebSocket ──
  useNetworkMonitor({
    onEvents:       handleEvents,
    onStatusUpdate: handleStatus,
  });

  const nonLues = notifs.filter(n => !n.lu).length;

  const marquerLu = (id: number) =>
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, lu: true } : n));

  const marquerTousLus = () =>
    setNotifs(ns => ns.map(n => ({ ...n, lu: true })));

  return (
    <>
      {/* ── Toast notification réseau ── */}
      {toast && (
        <NetworkToast
          event={toast}
          onClose={() => setToast(null)}
        />
      )}

      <div style={{
        height: 'var(--topbar-h)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        gap: '1rem',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>

        {/* Titre */}
        <div style={{ flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>{subtitle}</p>
          )}
        </div>

        {/* Recherche */}
        <div style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
          <SearchIcon size={13} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            placeholder="Rechercher un employé, département, poste…"
            style={{ width: '100%', padding: '7px 12px 7px 30px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--text)', boxSizing: 'border-box' as const }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

          {/* Badge statut réseau temps réel */}
          <NetworkBadge status={netStatus} />

          {/* Toggle thème */}
          <button onClick={toggle} title={theme === 'light' ? 'Mode sombre' : 'Mode clair'}
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-subtle)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
          >
            {theme === 'light' ? <MoonIcon size={14} /> : <SunIcon size={14} />}
          </button>

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifs(v => !v)}
              style={{
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: showNotifs ? 'var(--primary-bg)' : 'var(--bg-subtle)',
                border: `1px solid ${showNotifs ? 'var(--primary-light)' : 'var(--border)'}`,
                borderRadius: 6, color: showNotifs ? 'var(--primary-light)' : 'var(--text-muted)',
                cursor: 'pointer', position: 'relative', transition: 'all 0.15s',
              }}
            >
              <BellIcon size={14} />
              {nonLues > 0 && (
                <div style={{
                  position: 'absolute', top: 5, right: 5,
                  width: 7, height: 7,
                  background: 'var(--danger)',
                  borderRadius: '50%',
                  border: '1.5px solid var(--card)',
                }} />
              )}
            </button>

            {/* Dropdown notifications */}
            {showNotifs && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                  onClick={() => setShowNotifs(false)}
                />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 340,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 99,
                  animation: 'fadeUp 0.15s ease',
                  overflow: 'hidden',
                }}>

                  {/* Header dropdown */}
                  <div style={{
                    padding: '0.875rem 1rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        Notifications
                      </p>
                      {nonLues > 0 && (
                        <span style={{
                          background: 'var(--danger-bg)', color: 'var(--danger)',
                          border: '1px solid var(--danger-border)',
                          borderRadius: 10, padding: '1px 6px',
                          fontSize: 10, fontWeight: 700,
                        }}>
                          {nonLues} nouvelle{nonLues > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {/* Statut réseau inline dans le header */}
                      {netStatus && (
                        <span style={{
                          fontSize: 10, color: netStatus.online ? 'var(--success)' : 'var(--danger)',
                          fontWeight: 500,
                        }}>
                          {netStatus.online ? '● En ligne' : '● Hors ligne'}
                        </span>
                      )}
                      {nonLues > 0 && (
                        <button onClick={marquerTousLus} style={{
                          background: 'none', border: 'none',
                          fontSize: 10, color: 'var(--primary-light)',
                          cursor: 'pointer', fontWeight: 500,
                        }}>
                          Tout marquer lu
                        </button>
                      )}
                      <button onClick={() => setShowNotifs(false)} style={{
                        background: 'none', border: 'none',
                        color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                      }}>
                        <CloseIcon size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Liste notifications */}
                  <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                    {notifs.map(n => (
                      <div
                        key={n.id}
                        onClick={() => marquerLu(n.id)}
                        style={{
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                          background: n.lu ? 'transparent' : 'var(--bg-subtle)',
                          cursor: 'pointer', transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = n.lu ? 'transparent' : 'var(--bg-subtle)'}
                      >
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: n.lu ? 'var(--border)' : NOTIF_C[n.type],
                          marginTop: 5, flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            margin: 0, fontSize: 12,
                            fontWeight: n.lu ? 400 : 600,
                            color: 'var(--text)', lineHeight: 1.3,
                          }}>
                            {n.titre}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>
                            {n.desc}
                          </p>
                          <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>
                            {n.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div style={{ padding: '0.625rem 1rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <button style={{
                      background: 'none', border: 'none',
                      fontSize: 11, color: 'var(--primary-light)',
                      cursor: 'pointer', fontWeight: 500,
                    }}>
                      Voir toutes les notifications
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Séparateur */}
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

          {/* Profil */}
          <button style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'var(--bg-subtle)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '5px 10px 5px 6px',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
          >
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              MH
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
                M. Haroun
              </p>
              <p style={{ margin: 0, fontSize: 9, color: 'var(--text-muted)' }}>Analyste RH</p>
            </div>
            <ChevronDownIcon size={11} color="var(--text-muted)" />
          </button>
        </div>
      </div>
    </>
  );
}