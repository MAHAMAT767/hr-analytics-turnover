// src/pages/ProfilsRisque.tsx
// Page dédiée aux profils à risque élevé — design premium cohérent avec le Dashboard

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDataset } from '../api/client';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { ExportButton  } from '../components/ui/ExportButton';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────
interface Employe {
  EmployeeNumber: number;
  Department: string;
  JobRole: string;
  Gender: string;
  Age: number;
  YearsAtCompany: number;
  MonthlyIncome: number;
  JobSatisfaction: number;
  OverTime: string;
  Attrition: string;
  WorkLifeBalance: number;
  EnvironmentSatisfaction: number;
  YearsSinceLastPromotion: number;
  NumCompaniesWorked: number;
  DistanceFromHome: number;
  risque: string;
  proba: number;
}

const DANGER  = 'rgba(220,38,38,1)';
const WARNING = 'rgba(245,158,11,1)';
const SUCCESS = 'rgba(16,185,129,1)';
const PRIMARY = 'rgba(99,102,241,1)';

const RISK_THRESHOLDS = { critical: 70, high: 50, moderate: 30 };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS MÉTIER
// ─────────────────────────────────────────────────────────────────────────────
function getRisque(e: any): string {
  let s = 0;
  if (e.OverTime === 'Yes')   s += 2;
  if (e.JobSatisfaction <= 2) s += 2;
  if (e.MonthlyIncome < 3000) s += 1;
  if (e.YearsAtCompany < 2)   s += 1;
  return s >= 4 ? 'élevé' : s >= 2 ? 'moyen' : 'faible';
}

function getProbabilite(e: any): number {
  let s = 0;
  if (e.OverTime === 'Yes')    s += 0.25;
  if (e.JobSatisfaction === 1) s += 0.30;
  if (e.JobSatisfaction === 2) s += 0.15;
  if (e.MonthlyIncome < 2000)  s += 0.20;
  if (e.MonthlyIncome < 3000)  s += 0.10;
  if (e.YearsAtCompany < 2)    s += 0.10;
  return Math.min(Math.round(s * 100), 99);
}

function getRiskLevel(proba: number): { label: string; color: string; bg: string; border: string } {
  if (proba >= RISK_THRESHOLDS.critical) return { label: 'Critique',  color: DANGER,  bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.25)'  };
  if (proba >= RISK_THRESHOLDS.high)     return { label: 'Élevé',     color: WARNING, bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)' };
  return                                        { label: 'Modéré',    color: SUCCESS, bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS D'ANIMATION
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const dur = 900, start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplayed(value * e);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value]);
  return <span ref={ref}>{displayed.toFixed(decimals)}</span>;
}

const Divider = ({ label }: { label: React.ReactNode }) => (
  <motion.div initial={{ opacity: 0, scaleX: 0.8 }} animate={{ opacity: 1, scaleX: 1 }}
    transition={{ duration: 0.4 }}
    style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0.25rem 0 0.125rem' }}>
    <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--border))', flex: 1 }} />
    <span style={{
      fontSize: 10, fontWeight: 700, color: 'var(--primary-light)',
      textTransform: 'uppercase' as const, letterSpacing: '0.1em', whiteSpace: 'nowrap' as const,
      background: 'var(--primary-bg)', padding: '2px 10px', borderRadius: 20,
      border: '1px solid var(--primary-light)',
    }}>{label}</span>
    <div style={{ height: 1, background: 'linear-gradient(90deg, var(--border), transparent)', flex: 1 }} />
  </motion.div>
);

/** Barre de progression avec shimmer */
function RiskBar({ pct, color }: { pct: number; color: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} style={{ height: 5, background: 'var(--border)', borderRadius: 5, overflow: 'hidden', position: 'relative', minWidth: 52 }}>
      <motion.div
        initial={{ width: 0 }}
        animate={inView ? { width: `${pct}%` } : {}}
        transition={{ duration: 0.85, ease: [0.34, 1.1, 0.64, 1] }}
        style={{ height: '100%', borderRadius: 5, background: color, boxShadow: `0 0 5px ${color}55`, position: 'relative' }}
      >
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.4, delay: 0.8, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }}
        />
      </motion.div>
    </div>
  );
}

/** Stat KPI compact pour le header de la page */
function HeaderKpi({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      whileHover={{ y: -3, scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
      style={{
        background: hov ? `${color}0e` : 'var(--card)',
        border: `1px solid ${hov ? `${color}40` : 'var(--border)'}`,
        borderRadius: 10, padding: '12px 16px', cursor: 'default',
        position: 'relative', overflow: 'hidden',
        transition: 'background 0.2s, border-color 0.2s',
        boxShadow: hov ? `0 8px 24px ${color}18` : 'none',
      }}>
      <motion.div animate={{ opacity: hov ? 1 : 0.3 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <p style={{ margin: '0 0 3px', fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)',
        textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1,
        color: hov ? color : 'var(--text)', transition: 'color 0.2s' }}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </p>
      {sub && <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>{sub}</p>}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RADAR SVG NATIF — sans recharts pour éviter les conflits de types
// ─────────────────────────────────────────────────────────────────────────────
function SvgRadar({
  data, color, size = 160,
}: { data: { axis: string; value: number }[]; color: string; size?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const cx = size / 2, cy = size / 2;
  const r  = size * 0.34;   // rayon max des données
  const n  = data.length;
  const levels = [0.25, 0.5, 0.75, 1];

  // Angle de chaque axe (départ à -90° pour avoir le premier axe en haut)
  const angle = (i: number) => (2 * Math.PI * i) / n - Math.PI / 2;

  // Coordonnées d'un point sur un axe i à un rayon donné
  const pt = (i: number, radius: number) => ({
    x: cx + radius * Math.cos(angle(i)),
    y: cy + radius * Math.sin(angle(i)),
  });

  // Polygone des valeurs
  const polygon = data
    .map((d, i) => pt(i, (d.value / 100) * r))
    .map(p => `${p.x},${p.y}`)
    .join(' ');

  // Polygone pour chaque niveau de grille
  const gridPolygon = (frac: number) =>
    data.map((_, i) => pt(i, frac * r)).map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grilles concentriques */}
      {levels.map(frac => (
        <polygon key={frac} points={gridPolygon(frac)}
          fill="none" stroke="var(--border)" strokeWidth={0.8} />
      ))}
      {/* Axes radiaux */}
      {data.map((_, i) => {
        const outer = pt(i, r);
        return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y}
          stroke="var(--border)" strokeWidth={0.8} />;
      })}
      {/* Zone de données animée */}
      <motion.polygon
        points={polygon}
        fill={color} fillOpacity={0.18}
        stroke={color} strokeWidth={1.6} strokeLinejoin="round"
        initial={{ scale: 0, opacity: 0 }}
        animate={inView ? { scale: 1, opacity: 1 } : {}}
        transition={{ duration: 0.6, ease: [0.34, 1.1, 0.64, 1] }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* Points sur les axes */}
      {data.map((d, i) => {
        const p = pt(i, (d.value / 100) * r);
        return (
          <motion.circle key={i} cx={p.x} cy={p.y} r={2.5}
            fill={color}
            initial={{ opacity: 0, scale: 0 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.5 + i * 0.06, duration: 0.25 }}
          />
        );
      })}
      {/* Labels des axes */}
      {data.map((d, i) => {
        const labelR = r + 14;
        const p = pt(i, labelR);
        return (
          <text key={i} x={p.x} y={p.y}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={8.5} fill="var(--text-muted)" fontWeight={600}>
            {d.axis}
          </text>
        );
      })}
    </svg>
  );
}

/** Carte de profil employé expandable */
function ProfileCard({ emp, index }: { emp: Employe; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const rl = getRiskLevel(emp.proba);
  const dept = emp.Department === 'Research & Development' ? 'R&D' : emp.Department;
  const flagOT = emp.OverTime === 'Yes';
  const initials = emp.JobRole.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();

  const radarData = [
    { axis: 'Satisfaction', value: emp.JobSatisfaction * 25 },
    { axis: 'Équilibre', value: (emp.WorkLifeBalance ?? 2) * 25 },
    { axis: 'Env. travail', value: (emp.EnvironmentSatisfaction ?? 2) * 25 },
    { axis: 'Ancienneté', value: Math.min(emp.YearsAtCompany * 7, 100) },
    { axis: 'Salaire', value: Math.min((emp.MonthlyIncome / 200), 100) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.03, 0.25), type: 'spring', stiffness: 280, damping: 26 }}
      layout
      style={{
        background: 'var(--card)', border: `1px solid ${expanded ? rl.border : 'var(--border)'}`,
        borderRadius: 12, overflow: 'hidden', cursor: 'default',
        transition: 'border-color 0.2s',
        boxShadow: expanded ? `0 8px 32px ${rl.color}18` : 'none',
      }}
    >
      {/* Liseré de risque */}
      <div style={{ height: 2.5, background: `linear-gradient(90deg, ${rl.color}, ${rl.color}60, transparent)` }} />

      {/* Header de la carte */}
      <div
        onClick={() => setExpanded(x => !x)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}
      >
        {/* Avatar */}
        <motion.div
          animate={expanded ? { rotate: 5, scale: 1.05 } : { rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 350, damping: 22 }}
          style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${rl.color}22, ${rl.color}10)`,
            border: `1.5px solid ${rl.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: rl.color, letterSpacing: '0.02em' }}>{initials}</span>
        </motion.div>

        {/* Infos principales */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>#{emp.EmployeeNumber}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {emp.JobRole}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-subtle)',
              padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>{dept}</span>
            {flagOT && (
              <span style={{ fontSize: 10, fontWeight: 700, color: WARNING,
                background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 4,
                border: '1px solid rgba(245,158,11,0.25)' }}>⏱ Heures sup.</span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{emp.Age} ans · {emp.YearsAtCompany} ans anc.</span>
          </div>
        </div>

        {/* Probabilité + niveau */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.04em', color: rl.color, lineHeight: 1 }}>
              {emp.proba}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: rl.color }}>%</span>
          </div>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: rl.color,
            background: rl.bg, border: `1px solid ${rl.border}`,
            padding: '1px 7px', borderRadius: 8, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
            {rl.label}
          </span>
        </div>

        {/* Chevron expand */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.22 }}
          style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>
          ▾
        </motion.div>
      </div>

      {/* Barre de risque sous le header */}
      <div style={{ padding: '0 14px 10px' }}>
        <RiskBar pct={emp.proba} color={rl.color} />
      </div>

      {/* Détails expandables */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.875rem' }}>

                {/* Stats de gauche */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Salaire mensuel',    value: `$${Number(emp.MonthlyIncome).toLocaleString('fr')}`,     color: SUCCESS },
                    { label: 'Satisfaction poste', value: `${emp.JobSatisfaction}/4`,                               color: emp.JobSatisfaction <= 2 ? DANGER : SUCCESS },
                    { label: 'Équilibre vie pro',  value: `${emp.WorkLifeBalance ?? '—'}/4`,                        color: PRIMARY },
                    { label: 'Nbre entreprises',   value: `${emp.NumCompaniesWorked ?? '—'}`,                       color: 'var(--text-muted)' },
                    { label: 'Distance domicile',  value: `${emp.DistanceFromHome ?? '—'} km`,                      color: 'var(--text-muted)' },
                    { label: 'Dernière promotion', value: `${emp.YearsSinceLastPromotion ?? '—'} an(s)`,            color: emp.YearsSinceLastPromotion > 3 ? WARNING : SUCCESS },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '5px 9px', background: 'var(--bg-subtle)', borderRadius: 6,
                      border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Radar SVG natif — évite les conflits de types recharts */}
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Profil multi-dimensionnel</p>
                  <SvgRadar data={radarData} color={rl.color} size={160} />
                </div>
              </div>

              {/* Facteurs de risque en badges */}
              <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap' as const, gap: 5 }}>
                {emp.OverTime === 'Yes' && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(245,158,11,0.1)', color: WARNING, border: '1px solid rgba(245,158,11,0.25)' }}>
                    ⚠ Heures supplémentaires
                  </span>
                )}
                {emp.JobSatisfaction <= 2 && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(220,38,38,0.08)', color: DANGER, border: '1px solid rgba(220,38,38,0.2)' }}>
                    ⚠ Satisfaction faible ({emp.JobSatisfaction}/4)
                  </span>
                )}
                {emp.MonthlyIncome < 3000 && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(220,38,38,0.08)', color: DANGER, border: '1px solid rgba(220,38,38,0.2)' }}>
                    ⚠ Salaire sous le seuil ($3 000)
                  </span>
                )}
                {emp.YearsAtCompany < 2 && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(99,102,241,0.1)', color: PRIMARY, border: '1px solid rgba(99,102,241,0.2)' }}>
                    ℹ Ancienneté &lt; 2 ans
                  </span>
                )}
                {(emp.YearsSinceLastPromotion ?? 0) > 3 && (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                    background: 'rgba(245,158,11,0.1)', color: WARNING, border: '1px solid rgba(245,158,11,0.25)' }}>
                    ⏳ Pas de promotion depuis {emp.YearsSinceLastPromotion} ans
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Panneau latéral d'analyse de la sélection */
function AnalysisPanel({ profiles }: { profiles: Employe[] }) {
  const total = profiles.length;
  if (total === 0) return null;

  const critical  = profiles.filter(e => e.proba >= RISK_THRESHOLDS.critical).length;
  const high      = profiles.filter(e => e.proba >= RISK_THRESHOLDS.high && e.proba < RISK_THRESHOLDS.critical).length;
  const moderate  = profiles.filter(e => e.proba < RISK_THRESHOLDS.high).length;
  const withOT    = profiles.filter(e => e.OverTime === 'Yes').length;
  const lowSatisf = profiles.filter(e => e.JobSatisfaction <= 2).length;
  const lowSalary = profiles.filter(e => e.MonthlyIncome < 3000).length;
  const probaMoy  = total ? Math.round(profiles.reduce((s, e) => s + e.proba, 0) / total) : 0;
  const salaireMoy = total ? Math.round(profiles.reduce((s, e) => s + e.MonthlyIncome, 0) / total) : 0;

  const deptDist = profiles.reduce((acc, e) => {
    const d = e.Department === 'Research & Development' ? 'R&D' : e.Department;
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const deptData = Object.entries(deptDist)
    .map(([name, count]) => ({ name, count, pct: Math.round(count / total * 100) }))
    .sort((a, b) => b.count - a.count);

  const stackData = [
    { label: 'Critique', value: critical,  color: DANGER  },
    { label: 'Élevé',    value: high,      color: WARNING },
    { label: 'Modéré',   value: moderate,  color: SUCCESS },
  ];

  return (
    <motion.div initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15, duration: 0.45 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

      {/* Résumé */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '1rem', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${DANGER}, ${WARNING}, ${SUCCESS})` }} />
        <p style={{ margin: '0 0 0.75rem', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Résumé de la sélection</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: '0.875rem' }}>
          {[
            { label: 'Profils',       value: total,    color: PRIMARY, unit: '' },
            { label: 'Proba. moy.',   value: probaMoy, color: DANGER,  unit: '%' },
            { label: 'Salaire moy.',  value: salaireMoy, color: SUCCESS, unit: '$', prefix: '$', noAnim: false },
            { label: 'Heures sup.',   value: Math.round(withOT/total*100), color: WARNING, unit: '%' },
          ].map(({ label, value, color, unit, prefix }) => (
            <div key={label} style={{ background: 'var(--bg-subtle)', borderRadius: 8,
              padding: '8px 10px', border: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 2px', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{label}</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1 }}>
                {prefix}<AnimatedNumber value={value} />{unit}
              </p>
            </div>
          ))}
        </div>

        {/* Stack bar niveaux */}
        <p style={{ margin: '0 0 5px', fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Répartition par sévérité</p>
        <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 1 }}>
          {stackData.map(({ label, value, color }) => (
            <motion.div key={label}
              initial={{ flex: 0 }}
              animate={{ flex: value }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              title={`${label}: ${value}`}
              style={{ background: color, minWidth: value > 0 ? 3 : 0 }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
          {stackData.map(({ label, value, color }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
              <span style={{ width: 6, height: 6, borderRadius: 2, background: color, display: 'inline-block' }} />
              {value} {label}
            </span>
          ))}
        </div>
      </div>

      {/* Facteurs de risque */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem' }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Facteurs déclenchants</p>
        {[
          { label: 'Heures supplémentaires', count: withOT,    pct: Math.round(withOT/total*100),    color: WARNING },
          { label: 'Satisfaction ≤ 2/4',     count: lowSatisf, pct: Math.round(lowSatisf/total*100), color: DANGER  },
          { label: 'Salaire &lt; $3 000',    count: lowSalary, pct: Math.round(lowSalary/total*100), color: DANGER  },
        ].map(({ label, count, pct, color }) => (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }} dangerouslySetInnerHTML={{ __html: label }} />
              <span style={{ fontSize: 11, fontWeight: 700, color }}>{count} ({pct}%)</span>
            </div>
            <RiskBar pct={pct} color={color} />
          </div>
        ))}
      </div>

      {/* Distribution par département */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem' }}>
        <p style={{ margin: '0 0 0.75rem', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Par département</p>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={deptData} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--text)' }} axisLine={false} tickLine={false} width={32} />
            <Tooltip formatter={(v: any) => [`${v} profils`, '']} cursor={{ fill: 'var(--bg-subtle)' }} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18} animationDuration={800}>
              {deptData.map((_, i) => (
                <Cell key={i} fill={i === 0 ? DANGER : i === 1 ? WARNING : PRIMARY} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Scatter income vs satisfaction */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem' }}>
        <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>Salaire vs. Satisfaction</p>
        <p style={{ margin: '0 0 0.625rem', fontSize: 10, color: 'var(--text-muted)' }}>Concentration des profils à risque</p>
        <ResponsiveContainer width="100%" height={140}>
          <ScatterChart margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" />
            <XAxis type="number" dataKey="x" name="Salaire" unit="$" tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v/1000)}k`} />
            <YAxis type="number" dataKey="y" name="Satisfaction" domain={[0.5, 4.5]}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <ZAxis range={[20, 60]} />
            <Tooltip cursor={{ fill: 'var(--bg-subtle)' }} content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
                  <p style={{ margin: 0 }}>Salaire: <b>${d.x?.toLocaleString()}</b></p>
                  <p style={{ margin: 0 }}>Satisfaction: <b>{d.y}/4</b></p>
                  <p style={{ margin: 0 }}>Proba: <b style={{ color: DANGER }}>{d.z}%</b></p>
                </div>
              );
            }} />
            <Scatter
              data={profiles.slice(0, 150).map(e => ({ x: e.MonthlyIncome, y: e.JobSatisfaction, z: e.proba }))}
              fill={DANGER} fillOpacity={0.55} animationDuration={600}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADER
// ─────────────────────────────────────────────────────────────────────────────
function PremiumLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '60vh', gap: 24 }}>
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i}
            style={{ position: 'absolute', inset: 0, border: '2px solid transparent',
              borderTopColor: DANGER, borderRadius: '50%' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2 - i * 0.2, repeat: Infinity, ease: 'linear', delay: i * 0.1 }} />
        ))}
      </div>
      <motion.p animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}
        style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
        Chargement des profils à risque…
      </motion.p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────
type ViewMode = 'cards' | 'table';
type SortKey  = 'proba' | 'Age' | 'YearsAtCompany' | 'MonthlyIncome' | 'JobSatisfaction' | 'EmployeeNumber';

export default function ProfilsRisque() {
  const { data: dsRes, isLoading } = useQuery({ queryKey: ['dataset'], queryFn: getDataset });

  // Filtres
  const [search,       setSearch]       = useState('');
  const [filterDept,   setFilterDept]   = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterLevel,  setFilterLevel]  = useState<'' | 'critique' | 'élevé' | 'modéré'>('');
  const [filterOT,     setFilterOT]     = useState<'' | 'Yes' | 'No'>('');
  const [salMax,       setSalMax]       = useState('');
  const [satisfMax,    setSatisfMax]    = useState('');
  const [probaMin,     setProbaMin]     = useState('');
  const [sortKey,      setSortKey]      = useState<SortKey>('proba');
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('desc');
  const [viewMode,     setViewMode]     = useState<ViewMode>('cards');
  const [page,         setPage]         = useState(1);
  const PER_PAGE = viewMode === 'cards' ? 12 : 15;

  const ds = dsRes?.data;

  const allRisque: Employe[] = useMemo(() =>
    (ds?.employes || [])
      .map((e: any) => ({ ...e, risque: getRisque(e), proba: getProbabilite(e) }))
      .filter((e: any) => e.risque === 'élevé'),
    [ds]
  );

  const depts   = useMemo(() => [...new Set(allRisque.map(e => e.Department))] as string[], [allRisque]);
  const genders = useMemo(() => [...new Set(allRisque.map(e => e.Gender))] as string[], [allRisque]);

  const filtered = useMemo(() => {
    let list = [...allRisque];
    if (filterDept)   list = list.filter(e => e.Department === filterDept);
    if (filterGender) list = list.filter(e => e.Gender === filterGender);
    if (filterOT)     list = list.filter(e => e.OverTime === filterOT);
    if (salMax)       list = list.filter(e => e.MonthlyIncome <= Number(salMax));
    if (satisfMax)    list = list.filter(e => e.JobSatisfaction <= Number(satisfMax));
    if (probaMin)     list = list.filter(e => e.proba >= Number(probaMin));
    if (filterLevel === 'critique') list = list.filter(e => e.proba >= RISK_THRESHOLDS.critical);
    if (filterLevel === 'élevé')    list = list.filter(e => e.proba >= RISK_THRESHOLDS.high && e.proba < RISK_THRESHOLDS.critical);
    if (filterLevel === 'modéré')   list = list.filter(e => e.proba < RISK_THRESHOLDS.high);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.JobRole?.toLowerCase().includes(q) ||
        e.Department?.toLowerCase().includes(q) ||
        String(e.EmployeeNumber).includes(q)
      );
    }
    return list.sort((a, b) => {
      const va = (a as any)[sortKey] ?? 0;
      const vb = (b as any)[sortKey] ?? 0;
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [allRisque, filterDept, filterGender, filterOT, salMax, satisfMax, probaMin, filterLevel, search, sortKey, sortDir]);

  const pages    = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const hasFilter = search || filterDept || filterGender || filterOT || salMax || satisfMax || probaMin || filterLevel;
  const resetFilters = () => {
    setSearch(''); setFilterDept(''); setFilterGender(''); setFilterOT('');
    setSalMax(''); setSatisfMax(''); setProbaMin(''); setFilterLevel('');
    setPage(1);
  };

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
    setPage(1);
  };

  const inputBase: React.CSSProperties = {
    padding: '6px 10px', fontSize: 11.5, borderRadius: 7,
    border: '1px solid var(--border)', background: 'var(--bg-subtle)',
    color: 'var(--text)', outline: 'none',
  };

  const critical  = allRisque.filter(e => e.proba >= RISK_THRESHOLDS.critical).length;
  const high      = allRisque.filter(e => e.proba >= RISK_THRESHOLDS.high && e.proba < RISK_THRESHOLDS.critical).length;
  const moderate  = allRisque.filter(e => e.proba < RISK_THRESHOLDS.high).length;
  const probaMoy  = allRisque.length ? Math.round(allRisque.reduce((s, e) => s + e.proba, 0) / allRisque.length) : 0;

  const SortTh = ({ label, k }: { label: string; k: SortKey }) => {
    const active = sortKey === k;
    return (
      <th onClick={() => toggleSort(k)} style={{
        textAlign: 'left', padding: '0 8px 8px', fontSize: 9.5, fontWeight: 700,
        color: active ? 'var(--primary-light)' : 'var(--text-muted)',
        textTransform: 'uppercase' as const, letterSpacing: '0.07em',
        cursor: 'pointer', userSelect: 'none' as const, whiteSpace: 'nowrap' as const,
        transition: 'color 0.15s',
      }}>
        {label} {active ? (sortDir === 'desc' ? '↓' : '↑') : ''}
      </th>
    );
  };

  if (isLoading) return <PremiumLoader />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── HEADER ── */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          paddingBottom: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <motion.span
                animate={{ opacity: [1, 0.4, 1], scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 8, height: 8, borderRadius: '50%', background: DANGER,
                  display: 'inline-block', boxShadow: `0 0 10px ${DANGER}` }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase' as const, color: DANGER }}>
                Centre de surveillance — Profils à risque élevé
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1,
              color: 'var(--text)' }}>
              {allRisque.length} profils identifiés
            </h1>
            <p style={{ margin: '5px 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
              Prédiction attrition · Random Forest · Seuil risque élevé dépassé
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Toggle vue */}
            <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8,
              border: '1px solid var(--border)', padding: 2, gap: 2 }}>
              {(['cards', 'table'] as ViewMode[]).map(mode => (
                <motion.button key={mode} onClick={() => { setViewMode(mode); setPage(1); }}
                  whileTap={{ scale: 0.96 }}
                  style={{ padding: '5px 12px', borderRadius: 6, border: 'none',
                    background: viewMode === mode ? 'var(--card)' : 'transparent',
                    color: viewMode === mode ? 'var(--text)' : 'var(--text-muted)',
                    fontWeight: viewMode === mode ? 700 : 500, fontSize: 11.5,
                    cursor: 'pointer', boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s' }}>
                  {mode === 'cards' ? '⊞ Cartes' : '≡ Tableau'}
                </motion.button>
              ))}
            </div>
            <ExportButton options={[{
              label: 'Export CSV — Profils à risque élevé',
              type: 'csv', filename: 'profils_risque_eleve',
              data: filtered.map(e => ({
                ID: e.EmployeeNumber, Département: e.Department, Poste: e.JobRole,
                Genre: e.Gender, Âge: e.Age, Ancienneté: e.YearsAtCompany,
                Salaire: e.MonthlyIncome, Satisfaction: e.JobSatisfaction,
                HeuresSup: e.OverTime, Probabilité: `${e.proba}%`,
              })),
            }]} />
          </div>
        </div>

        {/* KPIs header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
          <HeaderKpi label="Total profils" value={allRisque.length} sub="risque élevé confirmé" color={DANGER} />
          <HeaderKpi label="Critique (≥70%)" value={critical}  sub={`${Math.round(critical/allRisque.length*100)}% du total`} color={DANGER}  />
          <HeaderKpi label="Élevé (50–69%)" value={high}      sub={`${Math.round(high/allRisque.length*100)}% du total`}     color={WARNING} />
          <HeaderKpi label="Modéré (30–49%)" value={moderate} sub={`${Math.round(moderate/allRisque.length*100)}% du total`} color={SUCCESS} />
          <HeaderKpi label="Proba. moy."    value={probaMoy}  sub="sur l'ensemble" color={PRIMARY} />
        </div>
      </motion.div>

      {/* ── FILTRES ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}>
        <Divider label="Filtres & Tri" />
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '0.875rem 1rem', marginTop: '0.875rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
              <b style={{ color: 'var(--primary-light)' }}><AnimatedNumber value={filtered.length} /></b>
              /{allRisque.length} profils affichés
            </span>
            <AnimatePresence>
              {hasFilter && (
                <motion.button initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }} onClick={resetFilters}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5,
                    padding: '3px 9px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                    cursor: 'pointer', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}
                  whileHover={{ borderColor: DANGER, color: DANGER }}>
                  ✕ Réinitialiser
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' as const, alignItems: 'center' }}>
            {/* Recherche */}
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="ID, poste…" style={{ ...inputBase, minWidth: 150, flex: 1 }} />

            {/* Niveau de risque */}
            <select value={filterLevel} onChange={e => { setFilterLevel(e.target.value as any); setPage(1); }}
              style={{ ...inputBase, minWidth: 140 }}>
              <option value="">Niveau de risque</option>
              <option value="critique">Critique (≥70%)</option>
              <option value="élevé">Élevé (50–69%)</option>
              <option value="modéré">Modéré (30–49%)</option>
            </select>

            {/* Département */}
            <select value={filterDept} onChange={e => { setFilterDept(e.target.value); setPage(1); }}
              style={{ ...inputBase, minWidth: 130 }}>
              <option value="">Département</option>
              {depts.map(d => <option key={d} value={d}>{d === 'Research & Development' ? 'R&D' : d}</option>)}
            </select>

            {/* Genre */}
            <select value={filterGender} onChange={e => { setFilterGender(e.target.value); setPage(1); }}
              style={{ ...inputBase, minWidth: 100 }}>
              <option value="">Genre</option>
              {genders.map(g => <option key={g} value={g}>{g === 'Male' ? 'Homme' : 'Femme'}</option>)}
            </select>

            {/* Heures sup. */}
            <select value={filterOT} onChange={e => { setFilterOT(e.target.value as any); setPage(1); }}
              style={{ ...inputBase, minWidth: 120 }}>
              <option value="">Heures sup.</option>
              <option value="Yes">Avec HS</option>
              <option value="No">Sans HS</option>
            </select>

            {/* Salaire max */}
            <input type="number" placeholder="Salaire max ($)" value={salMax}
              onChange={e => { setSalMax(e.target.value); setPage(1); }}
              style={{ ...inputBase, width: 140 }} />

            {/* Satisfaction max */}
            <select value={satisfMax} onChange={e => { setSatisfMax(e.target.value); setPage(1); }}
              style={{ ...inputBase, minWidth: 140 }}>
              <option value="">Satisfaction (tous)</option>
              <option value="1">≤ 1 / 4</option>
              <option value="2">≤ 2 / 4</option>
              <option value="3">≤ 3 / 4</option>
            </select>

            {/* Proba min */}
            <input type="number" placeholder="Proba min (%)" value={probaMin}
              onChange={e => { setProbaMin(e.target.value); setPage(1); }}
              style={{ ...inputBase, width: 130 }} />

            {/* Tri */}
            <select value={`${sortKey}:${sortDir}`}
              onChange={e => { const [k, d] = e.target.value.split(':'); setSortKey(k as SortKey); setSortDir(d as 'asc' | 'desc'); setPage(1); }}
              style={{ ...inputBase, minWidth: 180 }}>
              <option value="proba:desc">Probabilité ↓ (défaut)</option>
              <option value="proba:asc">Probabilité ↑</option>
              <option value="MonthlyIncome:asc">Salaire ↑ (plus vulnérable)</option>
              <option value="MonthlyIncome:desc">Salaire ↓</option>
              <option value="Age:asc">Âge ↑</option>
              <option value="YearsAtCompany:asc">Ancienneté ↑</option>
              <option value="JobSatisfaction:asc">Satisfaction ↑</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* ── CONTENU PRINCIPAL ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1rem', alignItems: 'start' }}>

        {/* Zone gauche : cards ou tableau */}
        <div>
          <AnimatePresence mode="wait">

            {/* ── VUE CARTES ── */}
            {viewMode === 'cards' && (
              <motion.div key="cards"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  <AnimatePresence>
                    {paginated.map((emp, i) => (
                      <ProfileCard key={emp.EmployeeNumber} emp={emp} index={i} />
                    ))}
                  </AnimatePresence>
                  {paginated.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ padding: '3rem', textAlign: 'center', background: 'var(--card)',
                        border: '1px solid var(--border)', borderRadius: 12 }}>
                      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
                        Aucun profil ne correspond aux filtres sélectionnés.
                      </p>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── VUE TABLEAU ── */}
            {viewMode === 'table' && (
              <motion.div key="table"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ height: 2, background: `linear-gradient(90deg, ${DANGER}, ${WARNING}, ${PRIMARY})` }} />
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: 52  }} /> {/* ID */}
                        <col style={{ width: 58  }} /> {/* Dept */}
                        <col style={{ width: 130 }} /> {/* Poste */}
                        <col style={{ width: 42  }} /> {/* Âge */}
                        <col style={{ width: 68  }} /> {/* Ancienneté */}
                        <col style={{ width: 78  }} /> {/* Salaire */}
                        <col style={{ width: 72  }} /> {/* Satisfaction */}
                        <col style={{ width: 44  }} /> {/* HS */}
                        <col style={{ width: 130 }} /> {/* Probabilité */}
                      </colgroup>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                          <SortTh label="ID"          k="EmployeeNumber"  />
                          <SortTh label="Dept."       k="EmployeeNumber"  />
                          <th style={{ textAlign: 'left', padding: '0 8px 8px', fontSize: 9.5, fontWeight: 700,
                            color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>Poste</th>
                          <SortTh label="Âge"         k="Age"             />
                          <SortTh label="Anc."        k="YearsAtCompany"  />
                          <SortTh label="Salaire"     k="MonthlyIncome"   />
                          <SortTh label="Satisf."     k="JobSatisfaction" />
                          <th style={{ textAlign: 'left', padding: '0 8px 8px', fontSize: 9.5, fontWeight: 700,
                            color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>HS</th>
                          <SortTh label="Probabilité" k="proba" />
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence>
                          {paginated.map((e, i) => {
                            const rl = getRiskLevel(e.proba);
                            return (
                              <motion.tr key={e.EmployeeNumber}
                                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ delay: i * 0.025 }}
                                style={{ borderBottom: '1px solid var(--border)', cursor: 'default' }}
                                whileHover={{ backgroundColor: 'var(--bg-subtle)' } as any}
                              >
                                {/* ID */}
                                <td style={{ padding: '7px 8px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 10.5, whiteSpace: 'nowrap' as const }}>
                                  #{e.EmployeeNumber}
                                </td>
                                {/* Département abrégé */}
                                <td style={{ padding: '7px 8px', fontWeight: 600, color: 'var(--text)', fontSize: 10.5, whiteSpace: 'nowrap' as const }}>
                                  {e.Department === 'Research & Development' ? 'R&D'
                                    : e.Department === 'Human Resources' ? 'RH'
                                    : e.Department.split(' ')[0]}
                                </td>
                                {/* Poste tronqué */}
                                <td style={{ padding: '7px 8px', color: 'var(--text-muted)', fontSize: 10.5,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}
                                  title={e.JobRole}>
                                  {e.JobRole}
                                </td>
                                {/* Âge */}
                                <td style={{ padding: '7px 8px', color: 'var(--text)', fontSize: 10.5, whiteSpace: 'nowrap' as const }}>
                                  {e.Age}
                                </td>
                                {/* Ancienneté */}
                                <td style={{ padding: '7px 8px', color: 'var(--text)', fontSize: 10.5, whiteSpace: 'nowrap' as const }}>
                                  {e.YearsAtCompany} an{e.YearsAtCompany > 1 ? 's' : ''}
                                </td>
                                {/* Salaire */}
                                <td style={{ padding: '7px 8px', fontWeight: 600, color: 'var(--text)', fontSize: 10.5, whiteSpace: 'nowrap' as const }}>
                                  ${(e.MonthlyIncome / 1000).toFixed(1)}k
                                </td>
                                {/* Satisfaction dots */}
                                <td style={{ padding: '7px 8px' }}>
                                  <div style={{ display: 'flex', gap: 2 }}>
                                    {[1,2,3,4].map(s => (
                                      <div key={s} style={{ width: 5, height: 5, borderRadius: 1.5,
                                        background: s <= e.JobSatisfaction ? WARNING : 'var(--border)' }} />
                                    ))}
                                  </div>
                                </td>
                                {/* Heures sup */}
                                <td style={{ padding: '7px 8px' }}>
                                  {e.OverTime === 'Yes' && (
                                    <span style={{ fontSize: 9.5, fontWeight: 700, color: WARNING,
                                      background: 'rgba(245,158,11,0.12)', padding: '1px 5px', borderRadius: 3,
                                      whiteSpace: 'nowrap' as const }}>⏱ OUI</span>
                                  )}
                                </td>
                                {/* Probabilité : barre + % + niveau */}
                                <td style={{ padding: '7px 8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ flex: 1 }}>
                                      <RiskBar pct={e.proba} color={rl.color} />
                                    </div>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: rl.color,
                                      minWidth: 28, textAlign: 'right' as const }}>{e.proba}%</span>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: rl.color,
                                      background: rl.bg, border: `1px solid ${rl.border}`,
                                      padding: '1px 5px', borderRadius: 4,
                                      whiteSpace: 'nowrap' as const, textTransform: 'uppercase' as const,
                                      letterSpacing: '0.04em' }}>
                                      {rl.label}
                                    </span>
                                  </div>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>
                        {paginated.length === 0 && (
                          <tr><td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            Aucun profil ne correspond aux filtres.
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PAGINATION ── */}
          {pages > 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.875rem 0', marginTop: '0.5rem' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Page {page}/{pages} · {filtered.length} profils
              </span>
              <div style={{ display: 'flex', gap: 3 }}>
                <motion.button whileHover={page > 1 ? { scale: 1.1 } : {}} whileTap={page > 1 ? { scale: 0.95 } : {}}
                  onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border)',
                    background: 'var(--card)', color: 'var(--text)', cursor: page === 1 ? 'not-allowed' : 'pointer',
                    opacity: page === 1 ? 0.3 : 1, fontSize: 14 }}>‹</motion.button>

                {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                  const num = i + 1;
                  const active = page === num;
                  return (
                    <motion.button key={i} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
                      onClick={() => setPage(num)}
                      style={{ position: 'relative', width: 28, height: 28, borderRadius: 5,
                        border: '1px solid var(--border)', background: 'var(--card)',
                        color: active ? '#fff' : 'var(--text)', fontWeight: 600,
                        fontSize: 11, cursor: 'pointer', overflow: 'hidden' }}>
                      {active && (
                        <motion.div layoutId="riskPagePill"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          style={{ position: 'absolute', inset: 0, background: DANGER, zIndex: 0, borderRadius: 5 }} />
                      )}
                      <span style={{ position: 'relative', zIndex: 1 }}>{num}</span>
                    </motion.button>
                  );
                })}

                <motion.button whileHover={page < pages ? { scale: 1.1 } : {}} whileTap={page < pages ? { scale: 0.95 } : {}}
                  onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--border)',
                    background: 'var(--card)', color: 'var(--text)', cursor: page === pages ? 'not-allowed' : 'pointer',
                    opacity: page === pages ? 0.3 : 1, fontSize: 14 }}>›</motion.button>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── PANNEAU D'ANALYSE DROIT ── */}
        <AnalysisPanel profiles={filtered} />
      </div>
    </div>
  );
}