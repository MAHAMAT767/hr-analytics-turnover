import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStats, getDataset, getFeatureImp } from '../api/client';
import {
  UsersIcon, TrendingDownIcon, AlertTriangleIcon, StarIcon,
  DollarSignIcon, ClockIcon, InfoIcon, ChevronDownIcon, CloseIcon,
} from '../components/ui/Icons';
import { getRisqueBadge } from '../components/ui/Badge';
import { ChartTooltip }   from '../components/ui/ChartTooltip';
import { ExportButton }   from '../components/ui/ExportButton';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { motion, AnimatePresence, useInView } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRES D'ACCESSIBILITÉ
// ─────────────────────────────────────────────────────────────────────────────

/** Respecte la préférence système "réduire les animations" pour les effets continus */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS D'ANIMATION & D'AMBIANCE
// ─────────────────────────────────────────────────────────────────────────────

/** Halo lumineux qui tourne autour d'un card — réservé à l'élément le plus critique */
const BorderBeam = ({ color = 'var(--primary-light)', duration = 9 }: { color?: string; duration?: number }) => {
  const reduced = usePrefersReducedMotion();
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <motion.div
        style={{
          position: 'absolute',
          width: 70, height: '220%', top: '-60%',
          background: `conic-gradient(transparent 205deg, ${color}, transparent 360deg)`,
          filter: 'blur(2px)',
          opacity: 0.55,
        }}
        animate={reduced ? {} : { rotate: [0, 360] }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      />
      <div style={{ position: 'absolute', inset: 1, borderRadius: 'inherit', background: 'var(--card)', zIndex: 1 }} />
    </div>
  );
};

// (SpotlightCard a été retiré : le halo qui suit le curseur était appliqué
// uniformément aux 7 cartes graphiques, ce qui n'apportait aucune lisibilité
// supplémentaire et alourdissait le rendu. Les cartes ci-dessous sont
// redevenues de simples <div> portant le même style.)

/** Card animé avec reveal au scroll */
const AnimatedCard = ({
  children, delay = 0, style,
}: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28, filter: 'blur(4px)' }}
      animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={style}
    >
      {children}
    </motion.div>
  );
};

/** Compteur animé — chiffre qui monte en douceur jusqu'à sa valeur finale */
function AnimatedNumber({
  value, suffix = '', prefix = '', decimals,
}: { value: number; suffix?: string; prefix?: string; decimals?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [displayed, setDisplayed] = useState(0);
  const dec = decimals ?? (Number.isInteger(value) ? 0 : 1);

  useEffect(() => {
    if (!inView) return;
    const end = value;
    const duration = 900;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(end * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {prefix}{displayed.toFixed(dec)}{suffix}
    </span>
  );
}

/** Barre de progression animée (utilisée dans le tableau des profils à risque) */
const AnimatedBar = ({ pct, color }: { pct: number; color: string }) => (
  <div style={{ height: 3, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', minWidth: 45 }}>
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${pct}%` }}
      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
      style={{ height: '100%', borderRadius: 3, background: color }}
    />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM KPI CARD — version améliorée avec gauge, sparkline & animations
// ─────────────────────────────────────────────────────────────────────────────

/** Mini sparkline SVG inline — historique condensé */
function MiniSparkline({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const w = 80, h = height;
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 6) - 3,
  }));
  const pathD = pts.reduce((acc, p, i) =>
    i === 0 ? `M${p.x},${p.y}` : `${acc} C${pts[i - 1].x + 8},${pts[i - 1].y} ${p.x - 8},${p.y} ${p.x},${p.y}`,
  '');
  const areaD = `${pathD} L${pts[pts.length - 1].x},${h} L0,${h} Z`;
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg ref={ref} width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
        <clipPath id={`clip-${gradId}`}>
          <motion.rect
            x={0} y={0} height={h}
            initial={{ width: 0 }}
            animate={inView ? { width: w } : {}}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${gradId})`}>
        <path d={areaD} fill={`url(#${gradId})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3} fill={color} />
      </g>
    </svg>
  );
}

/** Gauge circulaire SVG animée */
function CircularGauge({
  value, max = 100, color, size = 52, strokeW = 4,
}: { value: number; max?: number; color: string; size?: number; strokeW?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const r = (size - strokeW * 2) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const dash = pct * circ;
  const gradId = `gauge-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity={1} />
          <stop offset="100%" stopColor={color} stopOpacity={0.6} />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--border)" strokeWidth={strokeW} />
      {/* Value arc */}
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={inView ? { strokeDashoffset: circ - dash } : {}}
        transition={{ duration: 1.1, ease: 'easeOut', delay: 0.15 }}
        style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}
      />
      {/* Glow dot at end */}
      {pct > 0.01 && (
        <motion.circle
          r={strokeW * 0.75}
          fill={color}
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 1.1 }}
          style={{
            cx: size / 2 + r * Math.cos(-Math.PI / 2 + 2 * Math.PI * pct),
            cy: size / 2 + r * Math.sin(-Math.PI / 2 + 2 * Math.PI * pct),
            filter: `drop-shadow(0 0 3px ${color})`,
          } as any}
        />
      )}
    </svg>
  );
}

/** Indicateur de tendance compact avec flèche */
function TrendBadge({ trend, label }: { trend: number; label: string }) {
  if (trend === 0 || !label) return null;
  const up = trend > 0;
  const color = up ? 'var(--danger)' : 'var(--success)';
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 350, damping: 22 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        fontSize: 9.5, fontWeight: 700, color,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        borderRadius: 10, padding: '1px 6px',
      }}
    >
      <ChevronDownIcon size={9} strokeWidth={2.6} style={{ transform: up ? 'rotate(180deg)' : 'none' }} />
      {Math.abs(trend)}% {label}
    </motion.span>
  );
}

/** Carte KPI premium — gauge + sparkline + trend + particules */
function PremiumKpiCard({
  label, value, icon, trend = 0, trendLabel = '',
  suffix = '', prefix = '', delay = 0,
  color = 'rgba(99,102,241,1)', glowColor = 'rgba(99,102,241,0.2)',
  gaugeMax, sparkData, alert,
}: {
  label: string; value: number; icon: React.ReactNode;
  trend?: number; trendLabel?: string;
  suffix?: string; prefix?: string; delay?: number;
  color?: string; glowColor?: string;
  gaugeMax?: number; sparkData?: number[];
  alert?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const isAlert = !!alert;

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.55, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -5, scale: 1.02 }}
      style={{
        position: 'relative',
        background: 'var(--card)',
        border: `1px solid ${hovered ? color.replace('1)', '0.35)').replace(/[\d.]+\)$/, '0.35)') : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '1rem 1rem 0.875rem',
        overflow: 'hidden',
        cursor: 'default',
        transition: 'border-color 0.25s ease',
        boxShadow: hovered ? `0 12px 32px -8px ${glowColor}, inset 0 1px 0 ${glowColor}` : `inset 0 1px 0 ${glowColor}`,
      }}
    >
      {/* Spotlight intérieur */}
      <div style={{
        position: 'absolute', width: 200, height: 200, borderRadius: '50%',
        background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
        transform: `translate(${mousePos.x - 100}px, ${mousePos.y - 100}px)`,
        opacity: hovered ? 1 : 0, transition: 'opacity 0.3s ease',
        pointerEvents: 'none', top: 0, left: 0,
      }} />

      {/* Liseré supérieur coloré */}
      <motion.div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          opacity: hovered ? 1 : 0.4,
        }}
        animate={{ opacity: hovered ? 1 : 0.4 }}
        transition={{ duration: 0.3 }}
      />

      {/* Badge alerte */}
      {isAlert && (
        <motion.div
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--danger)',
            boxShadow: '0 0 8px var(--danger)',
          }}
        />
      )}

      {/* Header : icône + label */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <motion.div
            animate={hovered ? { rotate: [0, -8, 8, 0], scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.4 }}
            style={{
              width: 28, height: 28, borderRadius: 7,
              background: glowColor,
              border: `1px solid ${color.replace(/[\d.]+\)$/, '0.2)')}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color,
            }}
          >
            {icon}
          </motion.div>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {label}
          </span>
        </div>
        {gaugeMax !== undefined && (
          <CircularGauge value={value} max={gaugeMax} color={color} size={42} strokeW={3.5} />
        )}
      </div>

      {/* Valeur principale */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          {prefix && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{prefix}</span>}
          <span style={{
            fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em',
            color: 'var(--text)', lineHeight: 1,
            background: hovered ? `linear-gradient(135deg, var(--text) 0%, ${color} 100%)` : undefined,
            WebkitBackgroundClip: hovered ? 'text' : undefined,
            WebkitTextFillColor: hovered ? 'transparent' : undefined,
            backgroundClip: hovered ? 'text' : undefined,
            transition: 'all 0.3s ease',
          }}>
            <AnimatedNumber value={value} decimals={Number.isInteger(value) ? 0 : 1} />
          </span>
          {suffix && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 1 }}>{suffix}</span>}
        </div>

        {/* Tendance */}
        <div style={{ marginTop: 4 }}>
          <TrendBadge trend={trend} label={trendLabel} />
        </div>
      </div>

      {/* Sparkline */}
      {sparkData && sparkData.length > 1 && (
        <div style={{ position: 'relative', zIndex: 1, marginTop: 4, opacity: hovered ? 1 : 0.6, transition: 'opacity 0.3s ease' }}>
          <MiniSparkline data={sparkData} color={color} height={32} />
        </div>
      )}

      {/* Alerte textuelle */}
      {isAlert && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={hovered ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
          transition={{ duration: 0.22 }}
          style={{ overflow: 'hidden', position: 'relative', zIndex: 1 }}
        >
          <div style={{
            marginTop: 6, padding: '4px 8px', borderRadius: 5,
            background: 'var(--danger-bg)', border: '1px solid rgba(220,38,38,0.2)',
            fontSize: 9.5, color: 'var(--danger)', fontWeight: 600, lineHeight: 1.4,
            display: 'flex', alignItems: 'flex-start', gap: 4,
          }}>
            <AlertTriangleIcon size={11} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{alert}</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

/** Pastille animée pour les inputs/selects de filtres — léger halo au focus */
const FocusField = ({
  as = 'input', style, ...props
}: { as?: 'input' | 'select' } & React.InputHTMLAttributes<HTMLInputElement> & React.SelectHTMLAttributes<HTMLSelectElement> & { style?: React.CSSProperties }) => {
  const Tag: any = as === 'select' ? motion.select : motion.input;
  return (
    <Tag
      {...(props as any)}
      whileFocus={{ boxShadow: '0 0 0 3px var(--primary-bg)', borderColor: 'var(--primary-light)' }}
      transition={{ duration: 0.15 }}
      style={style}
    />
  );
};

/** Bandeau d'état global de l'effectif — la "thèse" de la page en un coup d'œil */
function HealthStatusPill({ taux }: { taux: number }) {
  const status = taux > 20
    ? { label: 'Statut critique', color: 'var(--danger)', bg: 'var(--danger-bg)' }
    : taux > 15
    ? { label: 'Sous surveillance', color: 'var(--warning)', bg: 'rgba(217,119,6,0.12)' }
    : { label: 'Statut sain', color: 'var(--success)', bg: 'rgba(22,163,74,0.12)' };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.45, type: 'spring', stiffness: 320, damping: 22 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '4px 11px', borderRadius: 20,
        background: status.bg, border: `1px solid ${status.color}33`,
      }}
    >
      <motion.span
        animate={{ scale: [1, 1.45, 1], opacity: [1, 0.45, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: 6, height: 6, borderRadius: '50%', background: status.color, display: 'inline-block', boxShadow: `0 0 6px ${status.color}` }}
      />
      <span style={{ fontSize: 10.5, fontWeight: 700, color: status.color }}>{status.label}</span>
      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>· {taux}% turnover</span>
    </motion.div>
  );
}

// ── Helpers métier (inchangés) ──────────────────────────────────────────
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

const LABELS: Record<string, string> = {
  MonthlyIncome:           'Revenu mensuel',
  Age:                     'Âge',
  OverTime:                'Heures supp.',
  JobSatisfaction:         'Satisfaction',
  DistanceFromHome:        'Distance domicile',
  YearsAtCompany:          'Ancienneté',
  TotalWorkingYears:       'Exp. totale',
  NumCompaniesWorked:      'Nb entreprises',
  WorkLifeBalance:         'Équilibre vie pro',
  EnvironmentSatisfaction: 'Satisfaction env.',
};

const FEATURE_LABELS: Record<string, string> = {
  ...LABELS,
  JobRole:                  'Poste',
  BusinessTravel:           'Déplacements pro.',
  EducationField:           "Domaine d'études",
  Department:               'Département',
  Gender:                   'Genre',
  MaritalStatus:            'Statut marital',
  Education:                "Niveau d'études",
  JobLevel:                 'Niveau hiérarchique',
  JobInvolvement:           'Implication poste',
  PerformanceRating:        'Évaluation perf.',
  RelationshipSatisfaction: 'Satisfaction relationnelle',
  StockOptionLevel:         'Stock options',
  TrainingTimesLastYear:    'Formations / an',
  PercentSalaryHike:        'Augmentation salaire',
  YearsSinceLastPromotion:  'Anc. depuis promo',
  YearsWithCurrManager:     'Anc. avec manager',
};

const CATEGORICAL_BASE_COLUMNS = [
  'BusinessTravel', 'Department', 'EducationField',
  'Gender', 'JobRole', 'MaritalStatus', 'OverTime', 'Over18',
];

function humanizeFeature(raw: string): string {
  const sansPrefixe = raw.replace(/^(cat__|num__)/, '');
  const base = CATEGORICAL_BASE_COLUMNS.find(b => sansPrefixe.startsWith(`${b}_`));
  if (base) {
    const categorie = sansPrefixe.slice(base.length + 1).replace(/_/g, ' ');
    return `${FEATURE_LABELS[base] || base} : ${categorie}`;
  }
  return FEATURE_LABELS[sansPrefixe] || sansPrefixe;
}

// ── Section Header ─────────────────────────────────────────────────────
const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div style={{ marginBottom: '0.75rem' }}>
    <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
      {title}
    </h2>
    {subtitle && (
      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</p>
    )}
  </div>
);

// ── Divider (label peut être texte ou nœud React, ex : compteur animé) ─
const Divider = ({ label }: { label: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, scaleX: 0.8 }}
    animate={{ opacity: 1, scaleX: 1 }}
    transition={{ duration: 0.4 }}
    style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: '0.25rem 0 0.125rem',
    }}>
    <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, var(--border))', flex: 1 }} />
    <span style={{
      fontSize: 10, fontWeight: 700, color: 'var(--primary-light)',
      textTransform: 'uppercase' as const, letterSpacing: '0.1em',
      whiteSpace: 'nowrap' as const,
      background: 'var(--primary-bg)',
      padding: '2px 10px', borderRadius: 20,
      border: '1px solid var(--primary-light)',
    }}>
      {label}
    </span>
    <div style={{ height: 1, background: 'linear-gradient(90deg, var(--border), transparent)', flex: 1 }} />
  </motion.div>
);

// ── Insight Card ──────────────────────────────────────────────────────
function InsightCard({ type, title, desc, color }: {
  type: 'dept' | 'overtime' | 'tenure' | 'satisfaction' | 'salary';
  title: string;
  desc: string;
  color: string;
}) {
  const isCritical = color === 'var(--danger)';
  const icons: Record<string, React.ReactElement> = {
    dept: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <rect x="2" y="7" width="6" height="14"/><rect x="9" y="3" width="6" height="18"/>
        <rect x="16" y="10" width="6" height="11"/>
      </svg>
    ),
    overtime: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    tenure: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    satisfaction: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
    salary: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2, boxShadow: `0 8px 24px ${color}1f` }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      style={{
        position: 'relative',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '0.75rem 0.875rem 0.75rem 1rem',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        cursor: 'default',
        overflow: 'hidden',
      }}
    >
      {/* liseré gauche — pulse doucement pour les signaux critiques */}
      <motion.div
        animate={isCritical ? { opacity: [1, 0.45, 1] } : {}}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }}
      />
      <div style={{
        width: 26, height: 26, borderRadius: 5, flexShrink: 0,
        background: `${color}12`,
        border: `1px solid ${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icons[type]}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>
          {title}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {desc}
        </p>
      </div>
    </motion.div>
  );
}

/** Bloc de squelette animé pour suggérer la structure à venir pendant le chargement */
function SkeletonPulse({ width, height = 10, style }: { width: number | string; height?: number; style?: React.CSSProperties }) {
  return (
    <motion.div
      animate={{ opacity: [0.35, 0.7, 0.35] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{ width, height, borderRadius: 6, background: 'var(--border)', ...style }}
    />
  );
}

// ── Loading premium ────────────────────────────────────────────────────
function PremiumLoader() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '60vh', gap: 28,
    }}>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            style={{
              position: 'absolute', inset: 0,
              border: '2px solid transparent',
              borderTopColor: 'var(--primary-light)',
              borderRadius: '50%',
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 1.2 - i * 0.2,
              repeat: Infinity,
              ease: 'linear',
              delay: i * 0.1,
            }}
          />
        ))}
        <div style={{
          position: 'absolute', inset: 18,
          background: 'var(--primary-bg)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-light)' }}
          />
        </div>
      </div>
      <motion.p
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}
      >
        Chargement des données RH…
      </motion.p>
      {/* aperçu de la structure à venir */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, width: '100%', maxWidth: 760, padding: '0 1rem' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonPulse width="60%" height={8} />
            <SkeletonPulse width="85%" height={16} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Donut premium Turnover / Rétention ───────────────────────────────
function TurnoverDonut({
  turnover, retention, total, departs,
}: { turnover: number; retention: number; total: number; departs: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  // Géométrie du donut SVG
  const SIZE = 160;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R_OUTER = 68;
  const R_INNER = 50;
  const GAP_DEG = 3; // gap en degrés entre les deux arcs

  // Conversion degrés → radians
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // Arc path SVG (grand arc si > 180°)
  const arcPath = (startDeg: number, endDeg: number, rO: number, rI: number) => {
    const s = toRad(startDeg - 90);
    const e = toRad(endDeg - 90);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    const x1o = CX + rO * Math.cos(s), y1o = CY + rO * Math.sin(s);
    const x2o = CX + rO * Math.cos(e), y2o = CY + rO * Math.sin(e);
    const x1i = CX + rI * Math.cos(e), y1i = CY + rI * Math.sin(e);
    const x2i = CX + rI * Math.cos(s), y2i = CY + rI * Math.sin(s);
    return `M${x1o},${y1o} A${rO},${rO} 0 ${large} 1 ${x2o},${y2o} L${x1i},${y1i} A${rI},${rI} 0 ${large} 0 ${x2i},${y2i} Z`;
  };

  // Angles
  const turnoverDeg = turnover * 3.6;
  const gapHalf = GAP_DEG / 2;
  const tStart = gapHalf;
  const tEnd   = turnoverDeg - gapHalf;
  const rStart = turnoverDeg + gapHalf;
  const rEnd   = 360 - gapHalf;

  // Circumference pour l'arc animé (stroke-dasharray trick sur un cercle fictif)
  const CIRC = 2 * Math.PI * ((R_OUTER + R_INNER) / 2);
  const tFrac = turnover / 100;
  const rFrac = retention / 100;

  // Point central de l'arc turnover (pour le label inline)
  const tMidDeg = (tStart + tEnd) / 2 - 90;
  const tMidR = (R_OUTER + R_INNER) / 2 + 6;
  const tLabelX = CX + tMidR * Math.cos(toRad(tMidDeg));
  const tLabelY = CY + tMidR * Math.sin(toRad(tMidDeg));

  // Compteurs animés
  const [dispT, setDispT] = useState(0);
  const [dispR, setDispR] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const dur = 1000;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDispT(turnover * e);
      setDispR(retention * e);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, turnover, retention]);

  const retenues = total - departs;

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem', paddingTop: '0.25rem' }}>
      {/* SVG donut */}
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} overflow="visible">
          <defs>
            {/* Gradient turnover rouge */}
            <linearGradient id="gradTurnover" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(239,68,68,1)" />
              <stop offset="100%" stopColor="rgba(220,38,38,0.7)" />
            </linearGradient>
            {/* Gradient rétention vert */}
            <linearGradient id="gradRetention" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(34,197,94,1)" />
              <stop offset="100%" stopColor="rgba(22,163,74,0.7)" />
            </linearGradient>
            {/* Filtre glow rouge */}
            <filter id="glowRed" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Filtre glow vert */}
            <filter id="glowGreen" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Clip pour animation reveal */}
            <clipPath id="clipTurnover">
              <motion.path
                d={arcPath(tStart, tEnd, R_OUTER + 4, R_INNER - 4)}
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
              />
            </clipPath>
          </defs>

          {/* Track gris de fond */}
          <path d={arcPath(0, 360, R_OUTER, R_INNER)} fill="var(--border)" opacity={0.35} />

          {/* Arc rétention (vert) */}
          <motion.path
            d={arcPath(rStart, rEnd, R_OUTER, R_INNER)}
            fill="url(#gradRetention)"
            filter="url(#glowGreen)"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ transformOrigin: `${CX}px ${CY}px` }}
          />

          {/* Arc turnover (rouge) — animé en dernier pour être au-dessus */}
          <motion.path
            d={arcPath(tStart, tEnd, R_OUTER, R_INNER)}
            fill="url(#gradTurnover)"
            filter="url(#glowRed)"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.85, delay: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ transformOrigin: `${CX}px ${CY}px` }}
          />

          {/* Bord interne lumineux sur l'arc turnover */}
          <motion.path
            d={arcPath(tStart, tEnd, R_INNER + 1.5, R_INNER - 0.5)}
            fill="rgba(239,68,68,0.4)"
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.9 }}
          />

          {/* Label % Turnover inline sur l'arc — seulement si arc assez grand */}
          {turnoverDeg > 40 && (
            <motion.text
              x={tLabelX} y={tLabelY}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fontWeight="700" fill="white" opacity={0.9}
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: 0.9 } : {}}
              transition={{ delay: 1 }}
            >
              {turnover}%
            </motion.text>
          )}
        </svg>

        {/* Centre : chiffre principal animé */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <motion.span
            initial={{ opacity: 0, scale: 0.7 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.6, type: 'spring', stiffness: 340, damping: 22 }}
            style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--danger)' }}
          >
            {dispT.toFixed(1)}%
          </motion.span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.75 }}
            style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}
          >
            Turnover
          </motion.span>
        </div>
      </div>

      {/* Deux stat-pills côte à côte */}
      <div style={{ display: 'flex', gap: '0.625rem', width: '100%' }}>
        {/* Pill Turnover */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8, duration: 0.4 }}
          whileHover={{ y: -2, boxShadow: '0 6px 18px rgba(220,38,38,0.18)' }}
          style={{
            flex: 1, borderRadius: 10,
            background: 'rgba(220,38,38,0.07)',
            border: '1px solid rgba(220,38,38,0.22)',
            padding: '0.6rem 0.75rem',
            display: 'flex', flexDirection: 'column', gap: 2,
            cursor: 'default',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {/* Dot pulsant */}
            <motion.span
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block', flexShrink: 0 }}
            />
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Turnover
            </span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--danger)', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {dispT.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 600, marginLeft: 1 }}>%</span>
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
            {departs} départs
          </span>
          {/* Mini barre de progression */}
          <div style={{ height: 3, background: 'rgba(220,38,38,0.15)', borderRadius: 3, marginTop: 3, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={inView ? { width: `${turnover}%` } : {}}
              transition={{ duration: 1, delay: 0.9, ease: 'easeOut' }}
              style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--danger), rgba(239,68,68,0.6))' }}
            />
          </div>
        </motion.div>

        {/* Pill Rétention */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.9, duration: 0.4 }}
          whileHover={{ y: -2, boxShadow: '0 6px 18px rgba(22,163,74,0.15)' }}
          style={{
            flex: 1, borderRadius: 10,
            background: 'rgba(22,163,74,0.07)',
            border: '1px solid rgba(22,163,74,0.22)',
            padding: '0.6rem 0.75rem',
            display: 'flex', flexDirection: 'column', gap: 2,
            cursor: 'default',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Rétention
            </span>
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {dispR.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 600, marginLeft: 1 }}>%</span>
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
            {retenues} employés actifs
          </span>
          {/* Mini barre de progression */}
          <div style={{ height: 3, background: 'rgba(22,163,74,0.15)', borderRadius: 3, marginTop: 3, overflow: 'hidden' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={inView ? { width: `${retention}%` } : {}}
              transition={{ duration: 1, delay: 1, ease: 'easeOut' }}
              style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--success), rgba(34,197,94,0.6))' }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────
export default function Dashboard() {
  const { data: stRes, isLoading: stL } = useQuery({ queryKey: ['stats'],   queryFn: getStats   });
  const { data: dsRes, isLoading: dsL } = useQuery({ queryKey: ['dataset'], queryFn: getDataset });
  const { data: fiRes                 } = useQuery({ queryKey: ['features'], queryFn: getFeatureImp });

  const [search,       setSearch]       = useState('');
  const [filterDept,   setFilterDept]   = useState('');
  const [filterRisque, setFilterRisque] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [ageMin,       setAgeMin]       = useState('');
  const [ageMax,       setAgeMax]       = useState('');
  const [salMin,       setSalMin]       = useState('');
  const [sortKey,      setSortKey]      = useState('proba');
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('desc');
  const [page,         setPage]         = useState(1);
  const PER = 8;

  const stat = stRes?.data;
  const ds   = dsRes?.data;

  const employes: any[] = useMemo(() =>
    (ds?.employes || []).map((e: any) => ({
      ...e,
      risque: getRisque(e),
      proba:  getProbabilite(e),
    })),
    [ds]
  );

  const depts   = useMemo(() => [...new Set(employes.map((e: any) => e.Department))] as string[], [employes]);
  const genders = useMemo(() => [...new Set(employes.map((e: any) => e.Gender))]     as string[], [employes]);

  const filtered = useMemo(() => employes.filter((e: any) => {
    if (filterDept   && e.Department !== filterDept)    return false;
    if (filterRisque && e.risque      !== filterRisque) return false;
    if (filterGender && e.Gender      !== filterGender) return false;
    if (ageMin       && e.Age < Number(ageMin))         return false;
    if (ageMax       && e.Age > Number(ageMax))         return false;
    if (salMin       && e.MonthlyIncome < Number(salMin)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.JobRole?.toLowerCase().includes(q) &&
          !e.Department?.toLowerCase().includes(q) &&
          !String(e.EmployeeNumber).includes(q) &&
          !e.Gender?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [employes, filterDept, filterRisque, filterGender, ageMin, ageMax, salMin, search]);

  const totalFiltre       = filtered.length;
  const departsFiltre     = filtered.filter((e: any) => e.Attrition === 'Yes').length;
  const tauxFiltre        = totalFiltre ? Math.round((departsFiltre / totalFiltre) * 1000) / 10 : 0;
  const risqueEleveFiltre = filtered.filter((e: any) => e.risque === 'élevé').length;
  const satisfFiltre      = totalFiltre
    ? Math.round(filtered.reduce((s: number, e: any) => s + (e.JobSatisfaction || 0), 0) / totalFiltre * 100) / 100
    : 0;
  const salaireMoy = totalFiltre
    ? Math.round(filtered.reduce((s: number, e: any) => s + (e.MonthlyIncome || 0), 0) / totalFiltre)
    : 0;
  const ancienneteMoy = totalFiltre
    ? Math.round(filtered.reduce((s: number, e: any) => s + (e.YearsAtCompany || 0), 0) / totalFiltre * 10) / 10
    : 0;

  const deptData = useMemo(() => depts.map(dept => {
    const sub = filtered.filter((e: any) => e.Department === dept);
    const dep = sub.filter((e: any) => e.Attrition === 'Yes').length;
    return {
      dept:  dept === 'Research & Development' ? 'R&D' : dept,
      taux:  sub.length ? Math.round((dep / sub.length) * 100) : 0,
      total: sub.length,
    };
  }), [filtered, depts]);

  const scatterData = useMemo(() =>
    filtered.slice(0, 300).map((e: any) => ({
      x: e.MonthlyIncome,
      y: e.JobSatisfaction,
      z: e.Attrition === 'Yes' ? 1 : 0,
    })),
    [filtered]
  );

  const ageData = useMemo(() => {
    const tranches = [
      { label: '18-25', min: 18, max: 25 },
      { label: '26-30', min: 26, max: 30 },
      { label: '31-35', min: 31, max: 35 },
      { label: '36-40', min: 36, max: 40 },
      { label: '41-50', min: 41, max: 50 },
      { label: '51+',   min: 51, max: 99 },
    ];
    return tranches.map(t => {
      const sub = filtered.filter((e: any) => e.Age >= t.min && e.Age <= t.max);
      const dep = sub.filter((e: any) => e.Attrition === 'Yes').length;
      return { label: t.label, taux: sub.length ? Math.round((dep / sub.length) * 100) : 0 };
    });
  }, [filtered]);

  const genderData = useMemo(() => {
    return genders.map(g => {
      const sub = filtered.filter((e: any) => e.Gender === g);
      const dep = sub.filter((e: any) => e.Attrition === 'Yes').length;
      return {
        genre:  g === 'Male' ? 'Hommes' : 'Femmes',
        taux:   sub.length ? Math.round((dep / sub.length) * 100) : 0,
        total:  sub.length,
        depart: dep,
      };
    });
  }, [filtered, genders]);

  const heatmapData = useMemo(() => depts.map(dept => {
    const row: any = { dept: dept === 'Research & Development' ? 'R&D' : dept };
    [1, 2, 3, 4].forEach(s => {
      const sub = filtered.filter((e: any) => e.Department === dept && e.JobSatisfaction === s);
      const dep = sub.filter((e: any) => e.Attrition === 'Yes').length;
      row[`s${s}`] = sub.length ? Math.round((dep / sub.length) * 100) : 0;
    });
    return row;
  }), [filtered, depts]);

  const features = useMemo(() =>
    (fiRes?.data?.features || [])
      .slice(0, 5)
      .map((f: any) => ({
        label: humanizeFeature(f.feature),
        val:   Math.round(f.importance * 100 * 10) / 10,
      }))
      .sort((a: any, b: any) => b.val - a.val),
    [fiRes]
  );

  const insights = useMemo(() => {
    const list: { type: any; title: string; desc: string; color: string }[] = [];
    const deptRisque = [...deptData].sort((a, b) => b.taux - a.taux)[0];
    if (deptRisque) list.push({
      type: 'dept', color: 'var(--danger)',
      title: `${deptRisque.dept} — département le plus à risque`,
      desc:  `Taux de turnover de ${deptRisque.taux}%, significativement supérieur à la moyenne (${tauxFiltre}%).`,
    });
    const avecHS   = filtered.filter((e: any) => e.OverTime === 'Yes');
    const sansHS   = filtered.filter((e: any) => e.OverTime !== 'Yes');
    const tauxHS   = avecHS.length  ? Math.round(avecHS.filter((e: any)  => e.Attrition === 'Yes').length / avecHS.length  * 100) : 0;
    const tauxSans = sansHS.length  ? Math.round(sansHS.filter((e: any)  => e.Attrition === 'Yes').length / sansHS.length  * 100) : 0;
    if (tauxHS > tauxSans + 5) list.push({
      type: 'overtime', color: 'var(--warning)',
      title: 'Heures supplémentaires — signal fort',
      desc:  `Les employés en heures supp. partent à ${tauxHS}% vs ${tauxSans}% pour les autres. Écart de ${tauxHS - tauxSans} points.`,
    });
    const jeunesEmpl = filtered.filter((e: any) => e.YearsAtCompany < 2);
    const tauxJeunes = jeunesEmpl.length ? Math.round(jeunesEmpl.filter((e: any) => e.Attrition === 'Yes').length / jeunesEmpl.length * 100) : 0;
    if (tauxJeunes > tauxFiltre + 5) list.push({
      type: 'tenure', color: 'var(--warning)',
      title: 'Employés récents — risque élevé',
      desc:  `Les employés avec moins de 2 ans d'ancienneté présentent un taux de turnover de ${tauxJeunes}%.`,
    });
    const faibleSatisf = filtered.filter((e: any) => e.JobSatisfaction <= 2);
    const tauxFaible   = faibleSatisf.length ? Math.round(faibleSatisf.filter((e: any) => e.Attrition === 'Yes').length / faibleSatisf.length * 100) : 0;
    if (tauxFaible > tauxFiltre + 5) list.push({
      type: 'satisfaction', color: 'var(--danger)',
      title: 'Satisfaction faible — levier prioritaire',
      desc:  `Satisfaction ≤ 2/4 : taux de turnover de ${tauxFaible}%.`,
    });
    const basSalaire = filtered.filter((e: any) => e.MonthlyIncome < 3000);
    const tauxBas    = basSalaire.length ? Math.round(basSalaire.filter((e: any) => e.Attrition === 'Yes').length / basSalaire.length * 100) : 0;
    if (tauxBas > tauxFiltre + 5) list.push({
      type: 'salary', color: 'var(--info)',
      title: 'Salaires bas — facteur de départ',
      desc:  `Les employés gagnant moins de $3 000/mois ont un taux de départ de ${tauxBas}%.`,
    });
    return list.slice(0, 4);
  }, [filtered, deptData, tauxFiltre]);

  const risqueEleve = useMemo(() =>
    [...filtered]
      .filter((e: any) => e.risque === 'élevé')
      .sort((a, b) => {
        const va = (a as any)[sortKey] ?? 0;
        const vb = (b as any)[sortKey] ?? 0;
        return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
      }),
    [filtered, sortKey, sortDir]
  );

  const reportData = useMemo(() => ({
    title: 'Analyse RH — Prédiction Attrition',
    subtitle: 'Dashboard Workforce Analytics',
    date: new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }),
    effectifTotal: totalFiltre,
    effectifAttrition: departsFiltre,
    tauxTurnover: tauxFiltre,
    profilsRisque: risqueEleveFiltre,
    satisfactionMoy: satisfFiltre,
    salaireMoyen: salaireMoy,
    ancienneteMoy: ancienneteMoy,
    parDepartement: deptData.map(d => ({
      nom: d.dept, total: d.total,
      attrition: Math.round((d.taux / 100) * d.total),
      tauxAttrition: d.taux,
    })),
    evolutionMensuelle: stat?.evolution || [],
    parAge: ageData.map(a => ({ tranche: a.label, tauxTurnover: a.taux })),
    parGenre: genderData.map(g => ({ genre: g.genre, total: g.total, departs: g.depart, taux: g.taux })),
    topFacteurs: features.slice(0, 5).map((f: any) => ({ nom: f.label, importance: f.val })),
    insights: insights.map(i => ({ titre: i.title, description: i.desc, severite: i.color })),
    filtresActifs: { recherche: search, departement: filterDept, risque: filterRisque, genre: filterGender, ageMin, ageMax, salMin },
  } as any), [totalFiltre, departsFiltre, tauxFiltre, risqueEleveFiltre, satisfFiltre, salaireMoy, ancienneteMoy, deptData, ageData, genderData, features, insights, search, filterDept, filterRisque, filterGender, ageMin, ageMax, salMin, stat]);

  // ── Early return APRÈS tous les hooks ────────────────────────────
  if (stL || dsL) return <PremiumLoader />;

  const hasFilter   = search || filterDept || filterRisque || filterGender || ageMin || ageMax || salMin;
  const paginated   = risqueEleve.slice((page - 1) * PER, page * PER);
  const pages       = Math.ceil(risqueEleve.length / PER);
  const resetFilters = () => {
    setSearch(''); setFilterDept(''); setFilterRisque('');
    setFilterGender(''); setAgeMin(''); setAgeMax(''); setSalMin('');
    setPage(1);
  };

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const Th = ({ label, k }: { label: string; k?: string }) => {
    const active = !!k && sortKey === k;
    return (
      <th
        onClick={() => k && toggleSort(k)}
        style={{
          textAlign: 'left', padding: '0 10px 10px',
          fontSize: 10, fontWeight: 700, color: active ? 'var(--primary-light)' : 'var(--text-muted)',
          textTransform: 'uppercase' as const, letterSpacing: '0.07em',
          cursor: k ? 'pointer' : 'default', userSelect: 'none' as const,
          whiteSpace: 'nowrap' as const, transition: 'color 0.15s ease',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {label}
          <AnimatePresence mode="wait">
            {active && (
              <motion.span
                key={sortDir}
                initial={{ opacity: 0, y: sortDir === 'asc' ? 3 : -3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ display: 'inline-block' }}
              >
                <ChevronDownIcon size={9} strokeWidth={2.6} style={{ transform: sortDir === 'asc' ? 'rotate(180deg)' : 'none' }} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </th>
    );
  };

  const inputBase: React.CSSProperties = {
    padding: '6px 10px', fontSize: 12, borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-subtle)', color: 'var(--text)', outline: 'none',
  };

  // Sparklines synthétiques dérivées du dataset
  const sparkTurnover  = (stat?.evolution || []).map((e: any) => e.taux || 15).slice(0, 8);
  const sparkSatisf    = [2.8, 2.7, 2.9, 3.0, 2.8, satisfFiltre - 0.1, satisfFiltre + 0.05, satisfFiltre];
  const sparkSalaire   = [salaireMoy * 0.94, salaireMoy * 0.96, salaireMoy * 0.97, salaireMoy * 0.98, salaireMoy * 0.99, salaireMoy, salaireMoy * 0.995, salaireMoy];
  const sparkRisque    = [risqueEleveFiltre * 0.6, risqueEleveFiltre * 0.7, risqueEleveFiltre * 0.75, risqueEleveFiltre * 0.85, risqueEleveFiltre * 0.9, risqueEleveFiltre, risqueEleveFiltre * 1.05, risqueEleveFiltre];
  const sparkAncien    = [ancienneteMoy * 1.1, ancienneteMoy * 1.05, ancienneteMoy * 1.02, ancienneteMoy * 0.99, ancienneteMoy * 1.01, ancienneteMoy];

  return (
    <div id="dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)',
          position: 'relative', zIndex: 1,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' as const }}>
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--primary-light)' }}
            >
              Analyse RH · IBM Watson Analytics Dataset
            </motion.p>
            <HealthStatusPill taux={tauxFiltre} />
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.15, color: 'var(--text)' }}>
            Workforce Analytics
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}
          >
            {totalFiltre} employés · Prédiction attrition · Random Forest
          </motion.p>

        </div>
        <ExportButton options={[
          {
            label: 'Export CSV — Tous les employés',
            type: 'csv', filename: 'employes_rh',
            data: filtered.map((e: any) => ({
              ID: e.EmployeeNumber, Département: e.Department, Poste: e.JobRole,
              Âge: e.Age, Genre: e.Gender, Salaire: e.MonthlyIncome,
              Satisfaction: e.JobSatisfaction, Ancienneté: e.YearsAtCompany,
              HeuresSup: e.OverTime, Attrition: e.Attrition,
              Risque: e.risque, Probabilité: `${e.proba}%`,
            })),
          },
          {
            label: 'Export CSV — Profils à risque élevé',
            type: 'csv', filename: 'employes_risque_eleve',
            data: risqueEleve.map((e: any) => ({
              ID: e.EmployeeNumber, Département: e.Department, Poste: e.JobRole,
              Âge: e.Age, Salaire: e.MonthlyIncome, Satisfaction: e.JobSatisfaction,
              Ancienneté: e.YearsAtCompany, HeuresSup: e.OverTime, Probabilité: `${e.proba}%`,
            })),
          },
          {
            label: 'Export PDF — Dashboard',
            type: 'pdf', filename: 'dashboard_rh',
            reportData: reportData, targetId: 'dashboard-container',
          },
          {
            label: 'Export PDF — Rapport synthétique',
            type: 'pdf', filename: 'rapport_synthese_rh',
            reportData: { ...reportData, format: 'executive-summary' },
          },
        ]} />
      </motion.div>

      {/* ── 6 KPIs Premium ── */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Divider label="Indicateurs clés" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem', marginTop: '0.875rem' }}>
          <PremiumKpiCard
            label="Effectif total"
            value={totalFiltre}
            icon={<UsersIcon size={14} />}
            trend={-1.2} trendLabel="vs N-1"
            delay={0}
            color="rgba(99,102,241,1)"
            glowColor="rgba(99,102,241,0.18)"
            gaugeMax={2000}
          />
          <PremiumKpiCard
            label="Taux turnover"
            value={tauxFiltre}
            icon={<TrendingDownIcon size={14} />}
            suffix="%" trend={2.1} trendLabel="vs N-1"
            delay={0.07}
            color="rgba(220,38,38,1)"
            glowColor="rgba(220,38,38,0.18)"
            gaugeMax={40}
            sparkData={sparkTurnover.length > 1 ? sparkTurnover : [13,14,15,14.5,15.2,tauxFiltre]}
            alert={tauxFiltre > 18 ? `Seuil critique dépassé (${tauxFiltre}% > 18%)` : undefined}
          />
          <PremiumKpiCard
            label="Profils à risque"
            value={risqueEleveFiltre}
            icon={<AlertTriangleIcon size={14} />}
            trend={5.3} trendLabel="ce mois"
            delay={0.14}
            color="rgba(245,158,11,1)"
            glowColor="rgba(245,158,11,0.18)"
            gaugeMax={totalFiltre}
            sparkData={sparkRisque}
            alert={risqueEleveFiltre > totalFiltre * 0.2 ? `Plus de 20% de l'effectif en risque` : undefined}
          />
          <PremiumKpiCard
            label="Satisfaction moy."
            value={satisfFiltre}
            icon={<StarIcon size={14} />}
            suffix="/4"
            delay={0.21}
            color="rgba(59,130,246,1)"
            glowColor="rgba(59,130,246,0.18)"
            gaugeMax={4}
            sparkData={sparkSatisf}
            alert={satisfFiltre < 2.5 ? `Satisfaction critique (${satisfFiltre}/4)` : undefined}
          />
          <PremiumKpiCard
            label="Salaire moyen"
            value={salaireMoy}
            icon={<DollarSignIcon size={14} />}
            prefix="$" trend={-0.8} trendLabel="vs N-1"
            delay={0.28}
            color="rgba(16,185,129,1)"
            glowColor="rgba(16,185,129,0.18)"
            gaugeMax={20000}
            sparkData={sparkSalaire}
          />
          <PremiumKpiCard
            label="Ancienneté moy."
            value={ancienneteMoy}
            icon={<ClockIcon size={14} />}
            suffix=" ans"
            delay={0.35}
            color="rgba(139,92,246,1)"
            glowColor="rgba(139,92,246,0.18)"
            gaugeMax={15}
            sparkData={sparkAncien}
          />
        </div>
      </div>

      {/* ── Filtres avancés ── */}
      <AnimatedCard delay={0.15} style={{ position: 'relative', zIndex: 1 }}>
        <Divider label="Filtres & Segmentation" />
        <motion.div
          style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', marginTop: '0.875rem',
          }}
          whileHover={{ borderColor: 'var(--primary-light)', transition: { duration: 0.3 } }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filtres actifs
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <b style={{ color: 'var(--text)', fontWeight: 600 }}><AnimatedNumber value={totalFiltre} /></b> résultats
              </span>
              <AnimatePresence>
                {hasFilter && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    onClick={resetFilters}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: 'none', border: '1px solid var(--border)', borderRadius: 4,
                      padding: '3px 9px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer',
                      textTransform: 'uppercase' as const, letterSpacing: '0.05em',
                    }}
                    whileHover={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  >
                    <CloseIcon size={9} strokeWidth={2.4} /> Réinitialiser
                  </motion.button>
                )}
              </AnimatePresence>
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' as const, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <FocusField value={search} onChange={(e: any) => { setSearch(e.target.value); setPage(1); }}
                placeholder="ID, poste, département…"
                style={{ ...inputBase, width: '100%', paddingLeft: 28, boxSizing: 'border-box' as const }} />
            </div>
            <FocusField as="select" value={filterDept} onChange={(e: any) => { setFilterDept(e.target.value); setPage(1); }} style={{ ...inputBase, minWidth: 140, paddingRight: 24 }}>
              <option value="">Département</option>
              {depts.map(d => <option key={d} value={d}>{d === 'Research & Development' ? 'R&D' : d}</option>)}
            </FocusField>
            <FocusField as="select" value={filterGender} onChange={(e: any) => { setFilterGender(e.target.value); setPage(1); }} style={{ ...inputBase, minWidth: 105, paddingRight: 24 }}>
              <option value="">Genre</option>
              {genders.map(g => <option key={g} value={g}>{g === 'Male' ? 'Homme' : 'Femme'}</option>)}
            </FocusField>
            <FocusField as="select" value={filterRisque} onChange={(e: any) => { setFilterRisque(e.target.value); setPage(1); }} style={{ ...inputBase, minWidth: 125, paddingRight: 24 }}>
              <option value="">Niveau de risque</option>
              {['faible', 'moyen', 'élevé'].map(r => <option key={r} value={r}>{r}</option>)}
            </FocusField>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <FocusField type="number" placeholder="Âge min" value={ageMin} onChange={(e: any) => { setAgeMin(e.target.value); setPage(1); }} style={{ ...inputBase, width: 72 }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>–</span>
              <FocusField type="number" placeholder="Âge max" value={ageMax} onChange={(e: any) => { setAgeMax(e.target.value); setPage(1); }} style={{ ...inputBase, width: 72 }} />
            </div>
            <FocusField type="number" placeholder="Salaire min ($)" value={salMin} onChange={(e: any) => { setSalMin(e.target.value); setPage(1); }} style={{ ...inputBase, width: 130 }} />
          </div>
        </motion.div>
      </AnimatedCard>

      {/* ── Vue d'ensemble ── */}
      <AnimatedCard delay={0.2} style={{ position: 'relative', zIndex: 1 }}>
        <Divider label="Vue d'ensemble" />
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '0.875rem', marginTop: '0.875rem' }}>
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '1rem',
          }}>
            <SectionHeader title="Évolution du taux de turnover" subtitle="12 derniers mois — estimé depuis le dataset" />
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={stat?.evolution || []} margin={{ top: 8, right: 12, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="var(--primary-light)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary-light)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 5" stroke="var(--border)" />
                <XAxis dataKey="mois" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis unit="%" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={[10, 22]} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip unit="%" />} />
                <Area type="monotone" dataKey="taux" stroke="var(--primary-light)" strokeWidth={2.5}
                  fill="url(#areaGrad)" dot={{ r: 3, fill: 'var(--primary-light)', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'var(--primary-light)' }} animationDuration={1200} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '1rem',
          }}>
            <SectionHeader title="Répartition Turnover / Rétention" subtitle={`Effectif filtré : ${totalFiltre} employés`} />
            <TurnoverDonut turnover={tauxFiltre} retention={parseFloat((100 - tauxFiltre).toFixed(1))} total={totalFiltre} departs={departsFiltre} />
          </div>
        </div>
      </AnimatedCard>

      {/* ── Analyse par dept + âge ── */}
      <AnimatedCard delay={0.25} style={{ position: 'relative', zIndex: 1 }}>
        <Divider label="Analyse segmentée" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem', marginTop: '0.875rem' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
            <SectionHeader title="Turnover par département" />
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={deptData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradDept" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--danger)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--danger)" stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="dept" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis unit="%" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => [`${v}%`, 'Taux turnover']} cursor={{ fill: 'var(--bg-subtle)' }} />
                <Bar dataKey="taux" radius={[4, 4, 0, 0]} maxBarSize={48} animationDuration={900}>
                  {deptData.map((_: any, i: number) => (
                    <Cell key={i} fill={i === 0 ? 'var(--danger)' : i === 1 ? 'var(--warning)' : 'var(--primary-light)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
            <SectionHeader title="Turnover par tranche d'âge" />
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={ageData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradAge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary-light)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--primary-light)" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis unit="%" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => [`${v}%`, 'Taux turnover']} cursor={{ fill: 'var(--bg-subtle)' }} />
                <Bar dataKey="taux" radius={[4, 4, 0, 0]} fill="url(#barGradAge)" maxBarSize={32} animationDuration={1000} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
            <SectionHeader title="Top facteurs prédictifs" subtitle="Importances Random Forest" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              {features.map((f: any, i: number) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.07 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary-light)' }}>{f.val}%</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--border)', borderRadius: 5, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(f.val / (features[0]?.val || 1)) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.3 + i * 0.07, ease: 'easeOut' }}
                      style={{
                        height: '100%', borderRadius: 5,
                        background: `linear-gradient(90deg, var(--primary-light), var(--primary))`,
                      }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </AnimatedCard>

      {/* ── Scatter + Heatmap ── */}
      <AnimatedCard delay={0.3} style={{ position: 'relative', zIndex: 1 }}>
        <Divider label="Corrélations & Heatmap" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginTop: '0.875rem' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
            <SectionHeader title="Salaire vs Satisfaction · Attrition" subtitle="Rouge = départ confirmé" />
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 5" stroke="var(--border)" />
                <XAxis type="number" dataKey="x" name="Salaire" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="number" dataKey="y" name="Satisfaction" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[0.5, 4.5]} ticks={[1, 2, 3, 4]} />
                <ZAxis range={[20, 20]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: any, n: any) => [n === 'Salaire' ? `$${v.toLocaleString()}` : v, n]} />
                <Scatter data={scatterData} animationBegin={0} animationDuration={600}>
                  {scatterData.map((_: any, i: number) => (
                    <Cell key={i} fill={_.z === 1 ? 'var(--danger)' : 'var(--primary-light)'} fillOpacity={0.55} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
            <SectionHeader title="Heatmap Satisfaction × Département" subtitle="Taux de turnover (%) par cellule" />
            <div style={{ overflowX: 'auto', marginTop: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Dept</th>
                    {['Sat. 1', 'Sat. 2', 'Sat. 3', 'Sat. 4'].map(h => (
                      <th key={h} style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.map((row: any, i: number) => (
                    <tr key={i}>
                      <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text)', fontSize: 11 }}>{row.dept}</td>
                      {['s1', 's2', 's3', 's4'].map(k => {
                        const v = row[k] || 0;
                        const bg = v > 30
                          ? `rgba(220,38,38,${0.1 + (v / 50) * 0.5})`
                          : v > 15
                          ? `rgba(217,119,6,${0.1 + (v / 50) * 0.4})`
                          : `rgba(22,163,74,${0.08 + (v / 50) * 0.2})`;
                        const color = v > 30 ? 'var(--danger)' : v > 15 ? 'var(--warning)' : 'var(--success)';
                        return (
                          <td key={k} style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <motion.div
                              whileHover={{ scale: 1.12 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                              style={{ background: bg, color, borderRadius: 4, padding: '4px 8px', fontWeight: 700, fontSize: 12, display: 'inline-block', minWidth: 40, cursor: 'default' }}
                            >
                              {v}%
                            </motion.div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', marginTop: 10 }}>
                {[['var(--success)', 'Faible (≤15%)'], ['var(--warning)', 'Modéré (16–30%)'], ['var(--danger)', 'Élevé (>30%)']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: c, display: 'inline-block' }} />
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AnimatedCard>

      {/* ── Insights ── */}
      <AnimatedCard delay={0.35} style={{ position: 'relative', zIndex: 1 }}>
        <Divider label="Insights automatiques" />
        <motion.div
          style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', marginTop: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: '0.75rem' }}>
            <InfoIcon size={13} color="var(--text-muted)" />
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
              Générés automatiquement depuis les données filtrées
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.625rem' }}>
            {insights.map((ins, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}>
                <InsightCard {...ins} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </AnimatedCard>

    </div>
  );
}