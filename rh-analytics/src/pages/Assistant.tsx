// src/pages/Assistant.tsx
// Assistant analytique RH — design system maison, icônes SVG sur mesure

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { chatMessage } from '../api/client';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useAnalyse } from '../context/AnalyseContext';
import { useEmployeeAnalysis } from '../hooks/useEmployeeAnalysis';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  ts?: string;
  id: string;
  copied?: boolean;
}

const B500  = '#2563EB';
const B600  = '#1D4ED8';
const B700  = '#1E40AF';
const B100  = '#DBEAFE';
const B50   = '#EFF6FF';
const G500  = '#16A34A';
const SLATE = '#64748B';
const MUTED = '#94A3B8';

const RISQUE_COLOR: Record<string, string> = {
  faible: '#16A34A', moyen: '#D97706', 'élevé': '#DC2626',
};
const RISQUE_BG: Record<string, string> = {
  faible: '#F0FDF4', moyen: '#FFFBEB', 'élevé': '#FFF1F2',
};

function toHtml(raw: string): string {
  let s = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/^#{1,3}\s+(.+)$/gm, '<h4 style="margin:.6em 0 .2em;font-size:13px;font-weight:700">$1</h4>');
  s = s.replace(/((?:^[ \t]*[*\-•][ \t]+.+(?:\n|$))+)/gm, (block) => {
    const lis = block.split('\n').filter(l => /^[ \t]*[*\-•][ \t]+/.test(l))
      .map(l => `<li>${l.replace(/^[ \t]*[*\-•][ \t]+/, '').trim()}</li>`).join('');
    return `<ul>${lis}</ul>`;
  });
  s = s.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>');
  return `<p>${s}</p>`;
}
function mkTs(): string { return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
function mkId(): string { return Math.random().toString(36).slice(2, 9); }

const ANALYSIS_KEYWORDS = ['analyse','analyser','analysez','risque','turnover','départ','prédiction','predict','facteur','shap','survie','rétention','profil','fiche','rapport','bilan','employé','employe'];
function extractEmployeeId(text: string): number | null {
  const lower = text.toLowerCase();
  const hasKw  = ANALYSIS_KEYWORDS.some(kw => lower.includes(kw));
  const num    = text.match(/\b(\d{1,4})\b/);
  if (hasKw && num) return parseInt(num[1], 10);
  const explicit = text.match(/employ[eé]\s*(?:n[°o]?|num[eé]ro|#|id)?\s*:?\s*(\d+)/i);
  if (explicit) return parseInt(explicit[1], 10);
  return null;
}

// Icônes SVG maison — tracé géométrique cohérent (grille 24, jointures carrées sur les
// formes structurelles, arrondies sur les pictos d'action), pas de set d'icônes générique.
const Icons = {
  bot: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M5 9.5 12 5l7 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <rect x="5.5" y="9.5" width="13" height="9.5" rx="2.2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M9.2 13.6v1.4M14.8 13.6v1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  send: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M4 12 19.5 4 13 19.5l-2.4-6.1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M10.6 13.4 19.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  refresh: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12a8 8 0 0 1 13.66-5.66M20 12a8 8 0 0 1-13.66 5.66"/>
      <path d="M17 4v3.2h-3.2M7 20v-3.2h3.2"/>
    </svg>
  ),
  copy: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8.5" y="8.5" width="12" height="12" rx="1.8"/>
      <path d="M15.5 8.5V5.8A1.8 1.8 0 0 0 13.7 4H5.8A1.8 1.8 0 0 0 4 5.8v7.9a1.8 1.8 0 0 0 1.8 1.8h2.7"/>
    </svg>
  ),
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5 9.5 18 20 6"/></svg>,
  download: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v11.5M7.5 11l4.5 4.5L16.5 11"/>
      <path d="M5 18.5h14"/>
    </svg>
  ),
  // pourquoi / facteur déclencheur
  alert: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 21 19H3z"/>
      <path d="M12 9.8v4M12 16.6h.01"/>
    </svg>
  ),
  // facteurs / dataset
  chart: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V11M10 19V5M16 19v-7.5M20.5 19H3.5"/>
    </svg>
  ),
  // département
  building: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 20V6.5L13 4v16M13 9h5v11M6 20h12.5"/>
      <path d="M8.6 8.5h.01M8.6 11.7h.01M8.6 14.9h.01M16 12.5h.01M16 15.5h.01"/>
    </svg>
  ),
  trendDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7l7 7 4-4 7 7"/><path d="M16 17h5v-5"/>
    </svg>
  ),
  trendUp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l7-7 4 4 7-7"/><path d="M16 7h5v5"/>
    </svg>
  ),
  // tendances dataset
  pulse: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12h4l2.2-6L12 18l2.4-9.5L16 12h5.5"/>
    </svg>
  ),
  user: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>
    </svg>
  ),
  // plan d'action
  target: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h6.5"/>
    </svg>
  ),
  // date estimée
  calendar: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M8 3.5v4M16 3.5v4M3.5 10.5h17"/>
    </svg>
  ),
  // rétention
  anchor: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="6" r="2"/><path d="M12 8v13M7 14a5 5 0 0 0 10 0M5.5 14H3M21 14h-2.5"/>
    </svg>
  ),
  // onglet RH
  users: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/>
      <path d="M15.5 6a2.7 2.7 0 0 1 0 5.3M19 20c0-2.6-1.6-4.5-3.8-5.2"/>
    </svg>
  ),
  // onglet dataset
  layers: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5 4 8l8 4.5L20 8z"/><path d="M4 12.5 12 17l8-4.5M4 16.5 12 21l8-4.5"/>
    </svg>
  ),
  // onglet analyse
  search: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5"/><path d="M19.5 19.5 15.3 15.3"/>
    </svg>
  ),
};

type SuggCat = 'analyse' | 'rh' | 'dataset';
const SUGGESTION_CATS: { id: SuggCat; label: string; icon: React.ReactNode }[] = [
  { id: 'analyse', label: 'Analyse', icon: Icons.search },
  { id: 'rh',      label: 'RH',      icon: Icons.users  },
  { id: 'dataset', label: 'Dataset', icon: Icons.layers },
];
const ALL_SUGGESTIONS: { icon: React.ReactNode; text: string; cat: SuggCat; contextual?: boolean }[] = [
  { icon: Icons.alert,     text: 'Pourquoi cet employé risque-t-il de partir ?',            cat: 'analyse', contextual: true },
  { icon: Icons.trendUp,   text: 'Quels sont ses principaux facteurs de risque SHAP ?',     cat: 'analyse', contextual: true },
  { icon: Icons.calendar,  text: 'Quelle est la date estimée de départ ?',                  cat: 'analyse', contextual: true },
  { icon: Icons.anchor,    text: "Que faire pour retenir cet employé ?",                    cat: 'rh',      contextual: true },
  { icon: Icons.target,    text: "Propose un plan d'action RH personnalisé",                cat: 'rh',      contextual: true },
  { icon: Icons.building,  text: 'Quel département est le plus concerné par le turnover ?', cat: 'rh'                       },
  { icon: Icons.trendDown, text: 'Comment réduire le turnover efficacement ?',              cat: 'rh'                       },
  { icon: Icons.chart,     text: 'Quels facteurs influencent le plus le turnover ?',        cat: 'dataset'                  },
  { icon: Icons.pulse,     text: 'Résume les tendances observées dans les données',         cat: 'dataset'                  },
  { icon: Icons.user,      text: "Quel est le profil type de l'employé à risque ?",         cat: 'dataset'                  },
];

function Reveal({ children, delay = 0, y = 14 }: { children: React.ReactNode; delay?: number; y?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y, filter: 'blur(3px)' }}
      animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}>
      {children}
    </motion.div>
  );
}

function UserBubble({ msg }: { msg: Msg }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 30, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 10, marginBottom: 20 }}>
      <div style={{ textAlign: 'right', maxWidth: 480 }}>
        <motion.div whileHover={{ scale: 1.01 }} style={{
          display: 'inline-block',
          background: `linear-gradient(135deg, ${B500} 0%, ${B700} 100%)`,
          color: '#fff', borderRadius: '20px 20px 5px 20px',
          padding: '11px 17px', fontSize: 13.5, lineHeight: 1.65, wordBreak: 'break-word',
          boxShadow: `0 4px 24px ${B500}35, 0 1px 3px ${B500}20`,
        }}>
          {msg.content}
        </motion.div>
        {msg.ts && <p style={{ margin: '5px 4px 0', fontSize: 10, color: MUTED }}>{msg.ts}</p>}
      </div>
      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 450, damping: 22 }}
        style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${B500}, ${B700})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10.5, fontWeight: 800, color: '#fff',
          boxShadow: `0 3px 12px ${B500}45`, letterSpacing: '0.02em',
        }}>
        MH
      </motion.div>
    </motion.div>
  );
}

function BotBubble({ msg, onCopy }: { msg: Msg; onCopy: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, x: -30, scale: 0.94 }} animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 20 }}>
      <motion.div initial={{ scale: 0, rotate: 20 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 450, damping: 22 }}
        style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(145deg, ${B50}, ${B100})`,
          border: `1.5px solid ${B500}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: B500, boxShadow: `0 2px 10px ${B500}18`,
        }}>
        {Icons.bot}
      </motion.div>
      <div style={{ maxWidth: 540, flex: 1 }}>
        <div style={{ position: 'relative' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}>
          <motion.div className="bot-msg" style={{
            background: 'var(--card, #fff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '20px 20px 20px 5px', padding: '12px 44px 12px 16px',
            fontSize: 13.5, lineHeight: 1.8, color: 'var(--text, #1e293b)',
            wordBreak: 'break-word', boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
          }} dangerouslySetInnerHTML={{ __html: toHtml(msg.content) }} />
          <AnimatePresence>
            {hovered && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.14 }}
                onClick={() => onCopy(msg.id)}
                whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
                title={msg.copied ? 'Copié !' : 'Copier'}
                style={{
                  position: 'absolute', top: 10, right: 10,
                  width: 28, height: 28, borderRadius: 7, border: 'none',
                  background: msg.copied ? '#DCFCE7' : B50, color: msg.copied ? G500 : SLATE,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                }}>
                <AnimatePresence mode="wait">
                  {msg.copied
                    ? <motion.span key="check" initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}>{Icons.check}</motion.span>
                    : <motion.span key="copy"  initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>{Icons.copy}</motion.span>}
                </AnimatePresence>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        {msg.ts && <p style={{ margin: '5px 4px 0', fontSize: 10, color: MUTED }}>{msg.ts}</p>}
      </div>
    </motion.div>
  );
}

function Typing() {
  return (
    <motion.div initial={{ opacity: 0, x: -20, y: 4 }} animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 4 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 20 }}>
      <motion.div animate={{ scale: [1, 1.07, 1] }} transition={{ duration: 2.2, repeat: Infinity }}
        style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(145deg, ${B50}, ${B100})`,
          border: `1.5px solid ${B500}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: B500,
        }}>
        {Icons.bot}
      </motion.div>
      <div style={{
        background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '20px 20px 20px 5px', padding: '14px 20px',
        display: 'flex', gap: 6, alignItems: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}>
        {[0, 1, 2].map(i => (
          <motion.span key={i}
            animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.85, repeat: Infinity, delay: i * 0.14, ease: 'easeInOut' }}
            style={{ width: 7, height: 7, borderRadius: '50%', background: B500, display: 'inline-block' }} />
        ))}
      </div>
    </motion.div>
  );
}

function EmptyState({ hasEmployee }: { hasEmployee: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20, padding: '3rem 2rem', textAlign: 'center',
      }}>
      <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, type: 'spring', stiffness: 260, damping: 22 }}
        style={{
          width: 64, height: 64, borderRadius: 16,
          background: `linear-gradient(145deg, ${B50} 0%, ${B100} 100%)`,
          border: `1.5px solid ${B500}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: B500, boxShadow: `0 6px 24px ${B500}16`,
        }}>
        {Icons.bot}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <p style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: 'var(--text, #1e293b)', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
          HR Insights Assistant
        </p>
        <p style={{ margin: 0, fontSize: 13.5, color: SLATE, maxWidth: 300, lineHeight: 1.7 }}>
          {hasEmployee
            ? "Employé chargé. Posez vos questions sur son profil de risque."
            : "Analysez le turnover, interprétez les prédictions et obtenez des recommandations RH."}
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.28, type: 'spring', stiffness: 280 }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: B50, border: `1px solid ${B100}`,
          borderRadius: 24, padding: '6px 16px',
          fontSize: 12, color: B500, fontWeight: 600,
          boxShadow: `0 2px 10px ${B500}12`,
        }}>
        <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
          style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
        En ligne · 1 470 employés analysés
      </motion.div>
    </motion.div>
  );
}

function EmployeePanel({ analyse }: { analyse: any }) {
  if (!analyse.employee || !analyse.prediction) return null;
  const emp  = analyse.employee;
  const pred = analyse.prediction;
  const niv  = pred.niveau_risque ?? 'faible';
  const pct  = Math.round((pred.probabilite ?? 0) * 100);
  const col  = RISQUE_COLOR[niv] ?? '#64748b';
  const bg   = RISQUE_BG[niv]   ?? '#f8fafc';
  const circ = 2 * Math.PI * 17;

  return (
    <Reveal>
      <div style={{
        borderRadius: 14, overflow: 'hidden',
        border: `1px solid ${col}28`,
        background: bg,
        boxShadow: `0 4px 24px ${col}12`,
      }}>
        <div style={{ height: 3, background: `linear-gradient(90deg, ${col}, ${col}55)` }} />
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 320 }}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${col}18`, border: `1.5px solid ${col}38`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 800, color: col,
              }}>
              #{emp.EmployeeNumber}
            </motion.div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--text, #1e293b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {emp.JobRole}
              </p>
              <p style={{ margin: 0, fontSize: 10.5, color: SLATE }}>
                {emp.Department === 'Research & Development' ? 'R&D' : emp.Department}
              </p>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: `${col}0E`, border: `1px solid ${col}22`,
              borderRadius: 10, padding: '10px 12px', marginBottom: 10,
            }}>
            <div>
              <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: col, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                Risque turnover
              </p>
              <motion.p animate={niv === 'élevé' ? { opacity: [1, 0.65, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ margin: 0, fontSize: 18, fontWeight: 900, color: col, letterSpacing: '-0.02em' }}>
                {niv.toUpperCase()}
              </motion.p>
            </div>
            <svg width="46" height="46" viewBox="0 0 46 46">
              <circle cx="23" cy="23" r="17" fill="none" stroke={`${col}18`} strokeWidth="4.5" />
              <motion.circle cx="23" cy="23" r="17" fill="none" stroke={col} strokeWidth="4.5"
                strokeLinecap="round" transform="rotate(-90 23 23)"
                initial={{ strokeDasharray: `0 ${circ}` }}
                animate={{ strokeDasharray: `${(pct / 100) * circ} ${circ}` }}
                transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }} />
              <text x="23" y="27" textAnchor="middle" fontSize="9.5" fontWeight="800" fill={col}>{pct}%</text>
            </svg>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            {[
              { label: 'Âge',         value: `${emp.Age} ans`,                                     warn: false },
              { label: 'Ancienneté',  value: `${emp.YearsAtCompany} ans`,                           warn: false },
              { label: 'Salaire',     value: `$${Number(emp.MonthlyIncome).toLocaleString('fr')}`,  warn: false },
              { label: 'Heures sup.', value: emp.OverTime === 'Yes' ? 'Oui' : 'Non',                 warn: emp.OverTime === 'Yes' },
            ].map(({ label, value, warn }, i) => (
              <motion.div key={label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + i * 0.06 }}
                style={{
                  background: 'rgba(255,255,255,0.75)', borderRadius: 8,
                  padding: '6px 9px', border: '1px solid rgba(0,0,0,0.05)',
                  backdropFilter: 'blur(4px)',
                }}>
                <p style={{ margin: 0, fontSize: 9, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: warn ? '#D97706' : 'var(--text, #1e293b)', marginTop: 1 }}>{value}</p>
              </motion.div>
            ))}
          </div>

          {analyse.shap?.contributions?.[0] && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
              style={{
                padding: '7px 10px',
                background: 'rgba(255,255,255,0.65)',
                borderRadius: 8, border: `1px solid ${col}18`,
                backdropFilter: 'blur(4px)',
              }}>
              <p style={{ margin: '0 0 2px', fontSize: 9, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Facteur SHAP #1
              </p>
              <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: col }}>
                {analyse.shap.contributions[0].feature?.replace(/_/g, ' ')}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </Reveal>
  );
}

function ConvStats({ messages }: { messages: Msg[] }) {
  const userCount = messages.filter(m => m.role === 'user').length;
  const botCount  = messages.filter(m => m.role === 'assistant').length;
  const words     = messages.reduce((acc, m) => acc + m.content.split(/\s+/).length, 0);
  if (messages.length === 0) return null;
  return (
    <Reveal delay={0.05}>
      <div style={{
        borderRadius: 12, border: '1px solid var(--border, #e2e8f0)',
        background: 'var(--card, #fff)', overflow: 'hidden', display: 'flex',
      }}>
        {[
          { label: 'Questions', value: userCount },
          { label: 'Réponses',  value: botCount  },
          { label: 'Mots',      value: words     },
        ].map(({ label, value }, i) => (
          <div key={label} style={{
            flex: 1, textAlign: 'center', padding: '11px 6px',
            borderRight: i < 2 ? '1px solid var(--border, #e2e8f0)' : 'none',
          }}>
            <motion.p key={value} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              style={{ margin: 0, fontSize: 18, fontWeight: 800, color: B500, letterSpacing: '-0.02em' }}>
              {value}
            </motion.p>
            <p style={{ margin: 0, fontSize: 9, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 1 }}>
              {label}
            </p>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

export default function Assistant() {
  const [messages,  setMessages]  = useState<Msg[]>([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [used,      setUsed]      = useState<Set<string>>(new Set());
  const [activeCat, setActiveCat] = useState<SuggCat>('analyse');
  const { analyse } = useAnalyse();
  const { analyzeEmployee } = useEmployeeAnalysis();
  const bottomRef   = useRef<HTMLDivElement>(null);
  const taRef       = useRef<HTMLTextAreaElement>(null);
  const hasEmployee = analyse.employeeNumber !== null;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 130) + 'px';
  }, [input]);
  useEffect(() => { if (hasEmployee) setActiveCat('analyse'); }, [hasEmployee]);

  const copyMessage = useCallback((id: string) => {
    const msg = messages.find(m => m.id === id); if (!msg) return;
    navigator.clipboard.writeText(msg.content).then(() => {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, copied: true } : m));
      setTimeout(() => setMessages(prev => prev.map(m => m.id === id ? { ...m, copied: false } : m)), 2000);
    });
  }, [messages]);

  const exportConversation = useCallback(() => {
    const txt = messages.map(m => `[${m.ts ?? ''}] ${m.role === 'user' ? 'Vous' : 'Assistant'} :\n${m.content}`).join('\n\n---\n\n');
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `conversation-rh-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click(); URL.revokeObjectURL(a.href);
  }, [messages]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim(); if (!msg || loading) return;
    if (text) setUsed(p => new Set(p).add(text));
    const userMsg: Msg = { role: 'user', content: msg, ts: mkTs(), id: mkId() };
    const history = [...messages, userMsg];
    setMessages(history); setInput(''); setLoading(true);
    try {
      let contexte_rh: Record<string, any> | undefined;
      if (analyse.prediction && analyse.shap) {
        // Un employé est déjà chargé (via AnalyseSHAP ou un message précédent) → Mode A direct.
        contexte_rh = {
          _prediction: analyse.prediction, _shap: analyse.shap, _survival: analyse.survival,
          _poste: analyse.employee?.JobRole ?? '', _departement: analyse.employee?.Department ?? '',
          _anciennete: analyse.employee?.YearsAtCompany ?? 0,
        };
      } else {
        const detectedId = extractEmployeeId(msg);
        if (detectedId !== null) {
          try {
            // Calcule predict + explain + survival ici (même logique que AnalyseSHAP).
            // setAnalyse() est appelé à l'intérieur du hook → le panneau employé de la
            // sidebar s'affiche automatiquement avec la jauge et les facteurs SHAP,
            // exactement comme sur la page AnalyseSHAP.
            const { employee: emp, prediction: pred, shap, survival: surv } = await analyzeEmployee(detectedId);
            contexte_rh = {
              _prediction: pred, _shap: shap, _survival: surv,
              _poste: emp?.JobRole ?? '', _departement: emp?.Department ?? '',
              _anciennete: emp?.YearsAtCompany ?? 0,
            };
          } catch (e: any) {
            // Employé introuvable dans le dataset (ou API indisponible) → on retombe
            // sur l'ancien comportement : le backend tentera sa propre résolution.
            console.warn("Analyse employé côté frontend impossible :", e?.message ?? e);
            contexte_rh = { employee_number: detectedId };
          }
        }
      }
      const r = await chatMessage({ messages: history, contexte_rh });
      setMessages([...history, { role: 'assistant', content: r.data.reponse, ts: mkTs(), id: mkId() }]);
    } catch {
      setMessages([...history, { role: 'assistant', content: "Erreur de connexion à l'API. Vérifiez que le serveur est actif sur le port 8000.", ts: mkTs(), id: mkId() }]);
    } finally { setLoading(false); }
  }, [input, loading, messages, analyse, analyzeEmployee]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  const canSend = input.trim().length > 0 && !loading;
  const catSuggestions = ALL_SUGGESTIONS.filter(s => {
    if (s.cat !== activeCat) return false;
    if (s.contextual && !hasEmployee) return false;
    return !used.has(s.text);
  });
  const niv = analyse.prediction?.niveau_risque;
  const col = niv ? (RISQUE_COLOR[niv] ?? B500) : B500;

  return (
    <>
      <style>{`
        .bot-msg p { margin:0 0 .5em; }
        .bot-msg p:last-child { margin-bottom:0; }
        .bot-msg ul { margin:.4em 0 .4em 1.2em; padding:0; }
        .bot-msg li { margin:.28em 0; }
        .bot-msg h4 { color:${B500}; margin:.7em 0 .25em; font-size:13px; font-weight:700; }
        .bot-msg strong { font-weight:700; color:${B600}; }
        .bot-msg code { background:${B50}; color:${B600}; border-radius:5px; padding:1px 6px; font-size:.85em; font-family:monospace; border:1px solid ${B100}; }
        .chat-input-wrap:focus-within { border-color:${B500} !important; box-shadow:0 0 0 3px ${B500}18 !important; }
        .send-btn:not(:disabled):hover { background:${B600} !important; }
        .msg-area::-webkit-scrollbar { width:3px; }
        .msg-area::-webkit-scrollbar-track { background:transparent; }
        .msg-area::-webkit-scrollbar-thumb { background:${B500}25; border-radius:4px; }
        .sugg-btn { transition:all .14s ease !important; }
        .sugg-btn:hover { background:${B50} !important; border-color:${B100} !important; color:${B500} !important; transform:translateX(3px); }
        .tab-pill { transition:all .15s ease; }
        .tab-pill:hover:not(.active) { background:${B50} !important; color:${B500} !important; }
      `}</style>

      {/* ── Header page ── */}
      <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            style={{ margin: '0 0 4px', fontSize: 10.5, fontWeight: 700, color: B500, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            Assistant analytique
          </motion.p>
          <motion.h1 initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }}
            style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text, #1e293b)', letterSpacing: '-0.03em' }}>
            Rapports &amp; Insights
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}
            style={{ margin: '4px 0 0', fontSize: 13, color: SLATE }}>
            Interrogez le modèle de turnover et obtenez des recommandations RH contextuelles.
          </motion.p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 2 }}>
          <AnimatePresence>
            {messages.length > 0 && (
              <>
                <motion.button key="export"
                  initial={{ opacity: 0, x: 10, scale: 0.88 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 10, scale: 0.88 }}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={exportConversation}
                  style={{
                    background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: 9, padding: '7px 13px', fontSize: 12, cursor: 'pointer',
                    color: SLATE, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}>
                  {Icons.download}<span>Exporter</span>
                </motion.button>
                <motion.button key="reset"
                  initial={{ opacity: 0, x: 10, scale: 0.88 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 10, scale: 0.88 }}
                  whileHover={{ scale: 1.04, borderColor: B500, color: B500 }} whileTap={{ scale: 0.96 }}
                  onClick={() => { setMessages([]); setUsed(new Set()); }}
                  style={{
                    background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: 9, padding: '7px 13px', fontSize: 12, cursor: 'pointer',
                    color: SLATE, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}>
                  <motion.span animate={loading ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 0.75, repeat: loading ? Infinity : 0, ease: 'linear' }}>
                    {Icons.refresh}
                  </motion.span>
                  <span>Nouvelle conversation</span>
                </motion.button>
              </>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 276px', gap: '1rem', alignItems: 'start' }}>

        {/* ── Zone chat ── */}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            display: 'flex', flexDirection: 'column', height: 660,
            borderRadius: 18, overflow: 'hidden',
            border: '1px solid var(--border, #e2e8f0)',
            background: 'var(--card, #fff)',
            boxShadow: '0 4px 40px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)',
          }}>

          {/* Header chat */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            background: `linear-gradient(105deg, ${B50} 0%, rgba(255,255,255,0) 60%)`,
            position: 'relative', overflow: 'hidden', flexShrink: 0,
          }}>
            <div style={{
              position: 'absolute', inset: 0, opacity: 0.022,
              backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
              backgroundSize: '18px 18px', pointerEvents: 'none',
            }} />
            <div
              style={{
                width: 42, height: 42, borderRadius: '50%',
                background: `linear-gradient(145deg, ${B50}, ${B100})`,
                border: `2px solid ${B500}26`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: B500, boxShadow: `0 0 0 5px ${B500}0A`,
                flexShrink: 0, position: 'relative', zIndex: 1,
              }}>
              {Icons.bot}
            </div>

            <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text, #1e293b)', letterSpacing: '-0.01em' }}>
                HR Insights Assistant
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <motion.span animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 2, repeat: Infinity }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>En ligne</span>
                {messages.length > 0 && (
                  <span style={{ fontSize: 11, color: MUTED }}>· {messages.length} message{messages.length > 1 ? 's' : ''}</span>
                )}
              </div>
            </div>

            <AnimatePresence>
              {hasEmployee && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.78, x: 10 }} animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.78, x: 10 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: niv ? RISQUE_BG[niv] : '#F0FDF4',
                    border: `1px solid ${col}32`, borderRadius: 22, padding: '5px 12px',
                    fontSize: 11.5, fontWeight: 600, color: col,
                    position: 'relative', zIndex: 1,
                  }}>
                  <motion.span animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 1.7, repeat: Infinity }}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: col, display: 'inline-block' }} />
                  Employé #{analyse.employeeNumber}
                  {analyse.employee?.JobRole && (
                    <span style={{ fontWeight: 400, opacity: 0.72 }}>
                      {' '}— {analyse.employee.JobRole.split(' ').slice(0, 2).join(' ')}
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Messages */}
          <div className="msg-area" role="log" aria-live="polite"
            style={{
              flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem 0.75rem',
              display: 'flex', flexDirection: 'column',
              background: 'var(--bg-subtle, #fafafa)',
            }}>
            <AnimatePresence mode="wait">
              {messages.length === 0
                ? <EmptyState key="empty" hasEmployee={hasEmployee} />
                : messages.map(m => m.role === 'user'
                    ? <UserBubble key={m.id} msg={m} />
                    : <BotBubble  key={m.id} msg={m} onCopy={copyMessage} />)
              }
            </AnimatePresence>
            <AnimatePresence>{loading && <Typing key="typing" />}</AnimatePresence>
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
            style={{ padding: '12px 16px 16px', borderTop: '1px solid var(--border, #e2e8f0)', background: 'var(--card, #fff)', flexShrink: 0 }}>
            <div className="chat-input-wrap" style={{
              display: 'flex', alignItems: 'flex-end', gap: 10,
              border: '1.5px solid var(--border, #e2e8f0)',
              borderRadius: 16, padding: '10px 10px 10px 16px',
              transition: 'border-color .18s, box-shadow .18s',
              background: 'var(--bg-subtle, #fafafa)',
            }}>
              <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={onKey} disabled={loading} rows={1}
                placeholder={hasEmployee ? `Question sur l'employé #${analyse.employeeNumber}…` : "Posez une question RH ou saisissez l'analyse d'un employé…"}
                style={{
                  flex: 1, resize: 'none', border: 'none', outline: 'none',
                  background: 'transparent', fontSize: 13.5, color: 'var(--text, #1e293b)',
                  lineHeight: 1.6, fontFamily: 'inherit', overflowY: 'hidden', minHeight: 24, paddingTop: 1,
                }} />
              <motion.button className="send-btn" onClick={() => send()} disabled={!canSend}
                whileHover={canSend ? { scale: 1.06 } : {}} whileTap={canSend ? { scale: 0.94 } : {}}
                style={{
                  width: 40, height: 40, borderRadius: 12, border: 'none',
                  background: canSend ? `linear-gradient(135deg, ${B500}, ${B700})` : '#F1F5F9',
                  color: canSend ? '#fff' : MUTED,
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'background .2s, box-shadow .2s',
                  boxShadow: canSend ? `0 4px 14px ${B500}38` : 'none',
                }}>
                {Icons.send}
              </motion.button>
            </div>
            <p style={{ margin: '6px 4px 0', fontSize: 10.5, color: MUTED }}>
              Maj+Entrée pour saut de ligne · Entrée pour envoyer
            </p>
          </motion.div>
        </motion.div>

        {/* ── Sidebar droite ── */}
        <motion.div initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.18, duration: 0.42 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <AnimatePresence>
            {hasEmployee && (
              <motion.div key="emp-panel"
                initial={{ opacity: 0, y: -12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}>
                <EmployeePanel analyse={analyse} />
              </motion.div>
            )}
          </AnimatePresence>

          <ConvStats messages={messages} />

          {/* Suggestions */}
          <Reveal delay={0.12}>
            <div style={{
              borderRadius: 16, border: '1px solid var(--border, #e2e8f0)',
              background: 'var(--card, #fff)', overflow: 'hidden',
              boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
            }}>
              <div style={{ padding: '12px 14px 0', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Suggestions
                </p>
                {/* Onglets pills */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
                  {SUGGESTION_CATS.map(cat => (
                    <motion.button key={cat.id} className={`tab-pill${activeCat === cat.id ? ' active' : ''}`}
                      onClick={() => setActiveCat(cat.id)} whileTap={{ scale: 0.95 }}
                      style={{
                        flex: 1, padding: '7px 4px', border: 'none', cursor: 'pointer',
                        borderRadius: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                        background: activeCat === cat.id ? B500 : 'transparent',
                        color: activeCat === cat.id ? '#fff' : SLATE,
                        fontWeight: activeCat === cat.id ? 700 : 500,
                        fontSize: 11,
                      }}>
                      <span style={{ display: 'flex' }}>{cat.icon}</span>
                      {cat.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div style={{ padding: '6px 8px 8px' }}>
                <AnimatePresence mode="wait">
                  <motion.div key={activeCat}
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}>
                    {catSuggestions.length === 0 ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{ padding: '16px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: MUTED }}>
                          {!hasEmployee && activeCat === 'analyse' ? Icons.search : Icons.check}
                        </span>
                        <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
                          {!hasEmployee && activeCat === 'analyse'
                            ? <>Analysez un employé dans l'onglet Scoring Client d'abord</>
                            : 'Toutes les suggestions ont été utilisées'}
                        </p>
                      </motion.div>
                    ) : catSuggestions.map((s, i) => (
                      <motion.button key={s.text} className="sugg-btn"
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10, scale: 0.92 }}
                        transition={{ delay: i * 0.04, type: 'spring', stiffness: 360, damping: 28 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => send(s.text)} disabled={loading}
                        style={{
                          width: '100%', textAlign: 'left', display: 'flex', alignItems: 'flex-start',
                          gap: 9, background: 'none', border: '1px solid transparent',
                          borderRadius: 9, padding: '8px 10px', fontSize: 12,
                          color: 'var(--text, #1e293b)', cursor: loading ? 'not-allowed' : 'pointer',
                          lineHeight: 1.5, opacity: loading ? 0.45 : 1, fontWeight: 500, marginBottom: 2,
                        }}>
                        <span style={{ color: MUTED, flexShrink: 0, marginTop: 1, display: 'flex' }}>{s.icon}</span>
                        <span>{s.text}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </Reveal>
        </motion.div>
      </div>
    </>
  );
}