// src/pages/Analyseshap.tsx
// Animations Aceternity + intégration AnalyseContext (partage vers Assistant)

import { useState, useRef, useEffect } from 'react';
import { useEmployeeAnalysis } from '../hooks/useEmployeeAnalysis';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid, ReferenceLine,
  Area, AreaChart,
} from 'recharts';
import {
  Search, AlertCircle, TrendingUp, TrendingDown,
  Clock, Calendar, ClipboardList,
} from 'lucide-react';
import { getRisqueBadge } from '../components/ui/Badge';
import { ChartTooltip }   from '../components/ui/ChartTooltip';
import { motion, AnimatePresence, useInView } from 'framer-motion';

// ─────────────────────────────────────────────────────────────────────────────
// ACETERNITY-STYLE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SpotlightCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  return (
    <div ref={ref} onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)} onMouseLeave={() => setOpacity(0)}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      <div style={{
        position: 'absolute', width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)',
        transform: `translate(${pos.x - 160}px, ${pos.y - 160}px)`,
        opacity, transition: 'opacity 0.3s ease', pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

function BorderBeam({ color = '#6366f1', duration = 5 }: { color?: string; duration?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <motion.div
        style={{
          position: 'absolute', width: 80, height: '150%', top: '-25%', left: '-40px',
          background: `linear-gradient(transparent, ${color}55, transparent)`, filter: 'blur(1px)',
        }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      />
      <div style={{ position: 'absolute', inset: 1.5, borderRadius: 'inherit', background: 'var(--card)', zIndex: 1 }} />
    </div>
  );
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 22, filter: 'blur(4px)' }}
      animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

// ── Couleurs risque ────────────────────────────────────────────────────
const RISQUE_C: Record<string, string> = {
  faible: 'var(--success)', moyen: 'var(--warning)', 'élevé': 'var(--danger)', erreur: 'var(--text-muted)',
};
const RISQUE_BG: Record<string, string> = {
  faible: 'var(--success-bg)', moyen: 'var(--warning-bg)', 'élevé': 'var(--danger-bg)', erreur: 'var(--bg-subtle)',
};
const RISQUE_BORDER: Record<string, string> = {
  faible: 'var(--success-border)', moyen: 'var(--warning-border)', 'élevé': 'var(--danger-border)', erreur: 'var(--border)',
};
const RISQUE_GLOW: Record<string, string> = {
  faible: 'rgba(16,185,129,0.25)', moyen: 'rgba(245,158,11,0.25)', 'élevé': 'rgba(220,38,38,0.3)', erreur: 'transparent',
};
const BEAM_COLOR: Record<string, string> = {
  faible: '#10b981', moyen: '#f59e0b', 'élevé': '#ef4444', erreur: '#6366f1',
};

// ── Traductions FR ─────────────────────────────────────────────────────
const FEATURE_FR: Record<string, string> = {
  MonthlyIncome: 'Salaire mensuel', Age: 'Âge', OverTime: 'Heures supplémentaires',
  JobSatisfaction: 'Satisfaction au travail', DistanceFromHome: 'Distance domicile–travail',
  YearsAtCompany: "Ancienneté dans l'entreprise", TotalWorkingYears: 'Expérience professionnelle totale',
  NumCompaniesWorked: "Nombre d'entreprises précédentes", WorkLifeBalance: 'Équilibre vie pro / perso',
  EnvironmentSatisfaction: "Satisfaction de l'environnement", StockOptionLevel: 'Niveau de stock-options',
  JobLevel: 'Niveau hiérarchique', JobInvolvement: 'Implication dans le poste',
  RelationshipSatisfaction: 'Satisfaction des relations', TrainingTimesLastYear: 'Formations suivies (an)',
  YearsSinceLastPromotion: 'Années depuis la dernière promotion', YearsWithCurrManager: 'Ancienneté avec le manager actuel',
  YearsInCurrentRole: 'Années dans le rôle actuel', PercentSalaryHike: 'Augmentation de salaire (%)',
  Education: "Niveau d'études", JobRole: 'Intitulé de poste', Department: 'Département',
  MaritalStatus: 'Situation matrimoniale', BusinessTravel: 'Fréquence de déplacements',
  EducationField: "Domaine d'études", Gender: 'Genre', PerformanceRating: 'Évaluation de performance',
  MonthlyRate: 'Taux mensuel', DailyRate: 'Taux journalier', HourlyRate: 'Taux horaire',
  SalaryPerYear: "Salaire rapporté à l'ancienneté", CareerStability: 'Stabilité de carrière',
  PromotionGap: 'Écart depuis la dernière promotion', OvertimeRisk: 'Risque lié aux heures supp.',
  WorkloadIndex: 'Indice de charge de travail', SatRisk: 'Risque de faible satisfaction',
  'OverTime_Yes': 'Heures supplémentaires : Oui', 'OverTime_No': 'Heures supplémentaires : Non',
  'Gender_Male': 'Genre : Homme', 'Gender_Female': 'Genre : Femme',
  'MaritalStatus_Single': 'Situation : Célibataire', 'MaritalStatus_Married': 'Situation : Marié(e)',
  'MaritalStatus_Divorced': 'Situation : Divorcé(e)',
  'BusinessTravel_Travel_Frequently': 'Déplacements : Fréquents',
  'BusinessTravel_Travel_Rarely': 'Déplacements : Rares', 'BusinessTravel_Non-Travel': 'Déplacements : Aucun',
  'Department_Sales': 'Département : Ventes', 'Department_Research & Development': 'Département : R&D',
  'Department_Human Resources': 'Département : RH', 'JobRole_Sales Executive': 'Poste : Commercial',
  'JobRole_Research Scientist': 'Poste : Chercheur', 'JobRole_Laboratory Technician': 'Poste : Technicien labo',
  'JobRole_Manufacturing Director': 'Poste : Directeur prod.', 'JobRole_Healthcare Representative': 'Poste : Représentant santé',
  'JobRole_Manager': 'Poste : Manager', 'JobRole_Sales Representative': 'Poste : Représentant ventes',
  'JobRole_Research Director': 'Poste : Directeur recherche', 'JobRole_Human Resources': 'Poste : Ressources humaines',
  'EducationField_Life Sciences': 'Formation : Sciences de la vie', 'EducationField_Other': 'Formation : Autre',
  'EducationField_Medical': 'Formation : Médecine', 'EducationField_Marketing': 'Formation : Marketing',
  'EducationField_Technical Degree': 'Formation : Technique', 'EducationField_Human Resources': 'Formation : RH',
};

function cleanFeatureName(raw: string): string {
  const clean = raw.replace(/^(num__|cat__|remainder__)/, '');
  if (FEATURE_FR[clean]) return FEATURE_FR[clean];
  const base = Object.keys(FEATURE_FR).find(k => clean.startsWith(k + '_') || clean === k);
  if (base) {
    const suffix = clean.slice(base.length + 1).replace(/_/g, ' ');
    return suffix ? `${FEATURE_FR[base]} : ${suffix}` : FEATURE_FR[base];
  }
  return clean.replace(/_/g, ' ');
}

function getRecoGlobale(niveauRisque: string, fiabilite?: string) {
  if (niveauRisque === 'élevé') return {
    titre: fiabilite === 'IMMINENT' ? 'Action immédiate requise' : 'Action prioritaire requise',
    message: "Risque de départ élevé : engager sans délai un entretien de rétention avec le manager et les RH.",
    couleur: 'var(--danger)', bg: 'var(--danger-bg)', border: 'var(--danger-border)',
  };
  if (niveauRisque === 'moyen') return {
    titre: 'Suivi rapproché recommandé',
    message: 'Risque modéré : planifier un point individuel dans les prochaines semaines pour désamorcer les facteurs de risque.',
    couleur: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)',
  };
  return {
    titre: 'Maintenir la vigilance',
    message: "Risque faible : aucune action urgente, mais un suivi régulier reste recommandé pour préserver l'engagement.",
    couleur: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success-border)',
  };
}

// ── Jauge circulaire SVG ultra-premium ────────────────────────────────
function GaugeCircle({ pct, couleur }: { pct: number; couleur: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const r = 66, cx = 90, cy = 92, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const angle = -Math.PI / 2 + (pct / 100) * 2 * Math.PI;
  const dotX = cx + r * Math.cos(angle);
  const dotY = cy + r * Math.sin(angle);
  const ticks = [0, 25, 50, 75, 100];
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: -14, borderRadius: '50%',
          background: `radial-gradient(circle, ${couleur}25 0%, transparent 70%)`, filter: 'blur(10px)' }}
      />
      <svg width="180" height="184" viewBox="0 0 180 184">
        <defs>
          <linearGradient id="gGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={couleur} stopOpacity={1} />
            <stop offset="100%" stopColor={couleur} stopOpacity={0.5} />
          </linearGradient>
          <filter id="gGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
        {/* Soft halo arc */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={couleur} strokeWidth="18"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} opacity={0.07} />
        {/* Main arc */}
        <motion.circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#gGrad)"
          strokeWidth="10" strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={inView ? { strokeDasharray: `${dash} ${circ}` } : {}}
          transition={{ duration: 1.3, ease: [0.34, 1.1, 0.64, 1], delay: 0.1 }}
          filter="url(#gGlow)"
        />
        {/* Tick marks */}
        {ticks.map(t => {
          const a = -Math.PI / 2 + (t / 100) * 2 * Math.PI;
          return (
            <line key={t}
              x1={cx + (r - 14) * Math.cos(a)} y1={cy + (r - 14) * Math.sin(a)}
              x2={cx + (r - 6) * Math.cos(a)} y2={cy + (r - 6) * Math.sin(a)}
              stroke="var(--border)" strokeWidth={1.5} strokeLinecap="round" />
          );
        })}
        {/* Glow dot at arc tip */}
        <motion.circle cx={dotX} cy={dotY} r={6} fill={couleur}
          initial={{ opacity: 0, r: 0 }} animate={inView ? { opacity: 1, r: 6 } : {}}
          transition={{ duration: 0.4, delay: 1.3 }} filter="url(#gGlow)" />
        <motion.circle cx={dotX} cy={dotY} fill={couleur} fillOpacity={0.25}
          initial={{ r: 0 }} animate={inView ? { r: [6, 16, 6] } : {}}
          transition={{ duration: 2.2, delay: 1.5, repeat: Infinity, ease: 'easeInOut' }} />
        {/* Center text */}
        <motion.text x={cx} y={cy - 8} textAnchor="middle" fontSize="30" fontWeight="900" fill={couleur}
          initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.9 }}>
          {pct}%
        </motion.text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9.5" fill="var(--text-muted)" fontWeight="700" letterSpacing="0.1em">
          PROBABILITÉ
        </text>
      </svg>
    </div>
  );
}

// ── Mini stat pill avec hover premium ─────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      whileHover={{ y: -2, scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      style={{ background: hov ? `${color}12` : 'var(--bg-subtle)',
        border: `1px solid ${hov ? `${color}38` : 'var(--border)'}`,
        borderRadius: 8, padding: '8px 12px', cursor: 'default',
        position: 'relative', overflow: 'hidden', transition: 'background 0.2s, border-color 0.2s' }}
    >
      <motion.div animate={{ opacity: hov ? 1 : 0.25 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <p style={{ margin: '0 0 2px', fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 600,
        textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800,
        color: hov ? color : 'var(--text)', transition: 'color 0.2s' }}>{value}</p>
    </motion.div>
  );
}

// ── SHAP Factor Card premium ───────────────────────────────────────────
function SHAPFactorCard({ label, shapValue, maxShap, direction, index }: {
  label: string; shapValue: number; maxShap: number;
  direction: 'augmente' | 'diminue'; index: number;
}) {
  const [hov, setHov] = useState(false);
  const color = direction === 'augmente' ? 'var(--danger)' : 'var(--success)';
  const colorHex = direction === 'augmente' ? '#ef4444' : '#10b981';
  const pct = (Math.abs(shapValue) / maxShap) * 100;
  const Icon = direction === 'augmente' ? TrendingUp : TrendingDown;
  return (
    <motion.div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      initial={{ opacity: 0, x: direction === 'augmente' ? -12 : 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, type: 'spring', stiffness: 280, damping: 24 }}
      whileHover={{ scale: 1.02, y: -1 }}
      style={{ background: hov ? `${colorHex}0d` : 'var(--card)',
        border: `1px solid ${hov ? `${colorHex}44` : `var(--${direction === 'augmente' ? 'danger' : 'success'}-border)`}`,
        borderRadius: 8, padding: '10px 14px', cursor: 'default',
        transition: 'all 0.2s ease',
        boxShadow: hov ? `0 4px 16px ${colorHex}20` : 'none',
        position: 'relative', overflow: 'hidden' }}
    >
      {/* Accent left */}
      <motion.div animate={{ height: hov ? '100%' : '55%', opacity: hov ? 1 : 0.5 }}
        transition={{ duration: 0.25 }}
        style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 3, background: color, borderRadius: '0 2px 2px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <motion.div animate={hov ? { rotate: direction === 'augmente' ? -8 : 8, scale: 1.15 } : { rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 350, damping: 20 }}
          style={{ width: 22, height: 22, borderRadius: 5, background: `${colorHex}18`,
            border: `1px solid ${colorHex}28`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={11} color={color} />
        </motion.div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 800, fontFamily: 'monospace', flexShrink: 0, color }}>
          {shapValue > 0 ? '+' : ''}{shapValue.toFixed(3)}
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.85, ease: [0.34, 1.1, 0.64, 1], delay: 0.05 * index + 0.1 }}
          style={{ height: '100%', borderRadius: 4, background: color, boxShadow: `0 0 6px ${colorHex}55`, position: 'relative' }}>
          <motion.div animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.2, delay: 0.8 + 0.05 * index, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />
        </motion.div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          Impact : <b style={{ color }}>{pct.toFixed(0)}%</b>
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>#{index + 1}</span>
      </div>
    </motion.div>
  );
}

const SectionLabel = ({ children }: { children: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
    <motion.div
      initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ width: 3, height: 16, background: 'var(--primary-light)',
        borderRadius: 2, transformOrigin: 'left', flexShrink: 0 }}
    />
    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--primary-light)',
      textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>
      {children}
    </p>
  </div>
);

// ── Empty state avec scan lines ────────────────────────────────────────
function EmptyState() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ textAlign: 'center', padding: '4rem 2rem',
        background: 'var(--card)', border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-md)', color: 'var(--text-muted)',
        position: 'relative', overflow: 'hidden' }}
    >
      <motion.div animate={{ y: ['-100%', '200%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
        style={{ position: 'absolute', left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, var(--primary-light)40, transparent)',
          pointerEvents: 'none' }}
      />
      <div style={{ position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
        backgroundSize: '24px 24px', opacity: 0.4, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
          <Search size={44} color="var(--border)" style={{ marginBottom: 16 }} />
        </motion.div>
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: 'var(--text-sub)' }}>
          Entrez un Employee Number pour lancer l'analyse
        </p>
        <p style={{ margin: '0 auto', fontSize: 12, maxWidth: 380, lineHeight: 1.6 }}>
          Vous obtiendrez la prédiction de turnover, sa probabilité, une estimation de la date de départ et le détail des facteurs SHAP.
        </p>
      </div>
    </motion.div>
  );
}

// ── Loading state ──────────────────────────────────────────────────────
function AnalysisLoader() {
  const steps = ['Récupération du profil…', 'Prédiction Random Forest…', 'Calcul SHAP…', 'Analyse de survie…'];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 600);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '3rem',
        background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i}
            style={{ position: 'absolute', inset: i * 6, border: '2px solid transparent',
              borderTopColor: i === 0 ? 'var(--primary-light)' : i === 1 ? 'var(--warning)' : 'var(--danger)',
              borderRadius: '50%' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1 + i * 0.4, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      </div>
      <div style={{ textAlign: 'center' }}>
        <AnimatePresence mode="wait">
          <motion.p key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
            style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--primary-light)' }}>
            {steps[step]}
          </motion.p>
        </AnimatePresence>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
          {steps.map((_, i) => (
            <motion.div key={i} animate={{ scale: i <= step ? 1 : 0.6, opacity: i <= step ? 1 : 0.3 }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-light)' }} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Composant principal ────────────────────────────────────────────────
export default function AnalyseSHAP() {
  const [searchId,     setSearchId]     = useState('');
  const [loading,      setLoading]      = useState(false);
  const [erreur,       setErreur]       = useState('');
  const [employee,     setEmployee]     = useState<any>(null);
  const [prediction,   setPrediction]   = useState<any>(null);
  const [shapData,     setShapData]     = useState<any>(null);
  const [survivalData, setSurvivalData] = useState<any>(null);
  const [analyzedAt,   setAnalyzedAt]   = useState('');
  const resultRef      = useRef<HTMLDivElement>(null);
  const { analyzeEmployee } = useEmployeeAnalysis();

  const handleSearch = async () => {
    const id = searchId.trim();
    if (!id) { setErreur('Entrez un Employee Number avant de lancer la recherche.'); return; }
    setLoading(true); setErreur('');
    setEmployee(null); setPrediction(null); setShapData(null); setSurvivalData(null);
    try {
      const { employee: emp, prediction: pred, shap, survival: surv } = await analyzeEmployee(id);
      setEmployee(emp);
      setPrediction(pred);
      setShapData(shap);
      setSurvivalData(surv);
      setAnalyzedAt(new Date().toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'medium' }));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const errMsg = typeof detail === 'string' ? detail
        : Array.isArray(detail) ? detail.map((d: any) => `${d.loc?.join('.')} — ${d.msg}`).join(' | ')
        : detail != null ? JSON.stringify(detail)
        : e?.message ?? "Impossible de joindre l'API. Vérifiez qu'elle tourne bien sur le port 8000.";
      setErreur(errMsg);
    } finally { setLoading(false); }
  };

  const contributions: any[] = shapData?.contributions ?? [];
  const chartData = contributions.slice(0, 10).map((c: any) => ({
    feature: cleanFeatureName(c.feature), value: Math.abs(c.shap_value),
    raw: c.shap_value, direction: c.direction,
  })).reverse();

  const increasing = contributions.filter(c => c.direction === 'augmente').slice(0, 5);
  const decreasing = contributions.filter(c => c.direction === 'diminue').slice(0, 5);
  const maxShap    = Math.max(...contributions.map((c: any) => Math.abs(c.shap_value)), 0.001);
  const recoGlobale = prediction ? getRecoGlobale(prediction.niveau_risque, survivalData?.fiabilite) : null;
  const pct     = prediction ? Math.round(prediction.probabilite * 100) : 0;
  const couleur = RISQUE_C[prediction?.niveau_risque ?? 'faible'];
  const courbe: any[] = survivalData?.courbe_survie ?? [];

  const empInfos = employee ? [
    { label: 'Département', value: employee.Department === 'Research & Development' ? 'R&D' : employee.Department },
    { label: 'Poste',       value: employee.JobRole },
    { label: 'Sexe',        value: employee.Gender === 'Male' ? 'Homme' : 'Femme' },
    { label: 'Âge',         value: `${employee.Age} ans` },
    { label: 'Ancienneté',  value: `${employee.YearsAtCompany} ans` },
    { label: 'Salaire',     value: `$${Number(employee.MonthlyIncome).toLocaleString()}` },
    { label: 'Heures sup.', value: employee.OverTime === 'Yes' ? 'Oui' : 'Non' },
  ] : [];

  const axisProps = {
    tick: { fontSize: 10, fill: 'var(--text-muted)' },
    axisLine: false as const, tickLine: false as const,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Section 1 : Recherche ── */}
      <Reveal>
        <motion.div
          whileHover={{ borderColor: 'var(--primary-light)', boxShadow: '0 0 24px rgba(99,102,241,0.12)' }}
          transition={{ duration: 0.3 }}
          style={{ background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '1.25rem 1.4rem',
            boxShadow: 'var(--shadow-xs)', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ position: 'absolute', inset: 0, opacity: 0.025,
            backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: '40px 40px', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <SectionLabel>Rechercher un employé</SectionLabel>
            <p style={{ margin: '0 0 1rem', fontSize: 12, color: 'var(--text-muted)' }}>
              Entrez un Employee Number (1 à 2068). Vous obtiendrez le risque de départ, le détail SHAP et une date de départ estimée.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const }}>
              <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
                <Search size={13} color="var(--text-muted)"
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="number" value={searchId} onChange={e => setSearchId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="N° employé (ex. 1, 42, 500...)"
                  style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 8,
                    border: '1.5px solid var(--border)', fontSize: 13, outline: 'none',
                    color: 'var(--text)', background: 'var(--card)', boxSizing: 'border-box' as const,
                    transition: 'border-color 0.2s, box-shadow 0.2s' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary-light)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                  onBlur={e  => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <motion.button onClick={handleSearch} disabled={loading}
                whileHover={!loading ? { scale: 1.03, boxShadow: '0 6px 24px rgba(99,102,241,0.35)' } : {}}
                whileTap={!loading ? { scale: 0.96 } : {}}
                style={{ padding: '9px 24px',
                  background: loading
                    ? 'var(--primary-bg)'
                    : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
                  color: loading ? 'var(--primary-light)' : '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
                  position: 'relative', overflow: 'hidden' }}>
                <AnimatePresence mode="wait">
                  <motion.span key={loading ? 'loading' : 'idle'}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {loading ? (
                      <>
                        <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                          style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(99,102,241,0.3)',
                            borderTopColor: 'var(--primary-light)', borderRadius: '50%' }} />
                        Analyse…
                      </>
                    ) : ' Analyser'}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </div>
            <AnimatePresence>
              {erreur && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
                    borderRadius: 8, padding: '0.625rem 0.875rem',
                    fontSize: 12, color: 'var(--danger)', fontWeight: 500 }}>
                  <AlertCircle size={14} />{erreur}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </Reveal>

      {/* ── Loading ── */}
      <AnimatePresence>{loading && <AnalysisLoader />}</AnimatePresence>

      {/* ── Résultats ── */}
      <AnimatePresence>
        {prediction && employee && !loading && (
          <motion.div ref={resultRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* ── Section 2 : Carte employé ── */}
            <Reveal delay={0.05}>
              <SpotlightCard style={{ background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '1.25rem 1.4rem', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  flexWrap: 'wrap' as const, gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                        style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--primary-bg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '1.5px solid var(--primary-light)', fontSize: 12, fontWeight: 700, color: 'var(--primary-light)' }}>
                        #{employee.EmployeeNumber}
                      </motion.div>
                      <div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                          Employé N° {employee.EmployeeNumber}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          {employee.JobRole} · {employee.Department === 'Research & Development' ? 'R&D' : employee.Department}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2,
                            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                            background: employee.Gender === 'Male' ? 'var(--primary-bg)' : 'var(--danger-bg)',
                            color: employee.Gender === 'Male' ? 'var(--primary-light)' : 'var(--danger)' }}>
                            {employee.Gender === 'Male' ? '♂ Homme' : '♀ Femme'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, justifyContent: 'flex-end' }}>
                      <Clock size={11} color="var(--text-muted)" />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Analysé le {analyzedAt}</span>
                    </div>
                    {employee.Attrition && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Attrition réelle :&nbsp;
                        <span style={{ fontWeight: 700, color: employee.Attrition === 'Yes' ? 'var(--danger)' : 'var(--success)' }}>
                          {employee.Attrition === 'Yes' ? 'Oui, départ confirmé' : 'Non, toujours en poste'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.6rem', marginTop: '1rem' }}>
                  {empInfos.map(({ label, value }, i) => (
                    <motion.div key={label}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.06 * i, type: 'spring', stiffness: 280, damping: 22 }}>
                      <StatPill label={label} value={value} color="var(--primary-light)" />
                    </motion.div>
                  ))}
                </div>
              </SpotlightCard>
            </Reveal>

            {/* ── Section 3 + 4 : Jauge + résultat ── */}
            <Reveal delay={0.1}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                {/* Jauge */}
                <motion.div style={{ background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '1.25rem 1.4rem',
                  position: 'relative', overflow: 'hidden',
                  boxShadow: `0 0 30px ${RISQUE_GLOW[prediction.niveau_risque]}` }}>
                  <BorderBeam color={BEAM_COLOR[prediction.niveau_risque]} duration={4} />
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <p style={{ margin: '0 0 1rem', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      Indicateur de risque de turnover
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem' }}>
                      <GaugeCircle pct={pct} couleur={couleur} />
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.6 }}
                        style={{ textAlign: 'center', width: '100%',
                          background: RISQUE_BG[prediction.niveau_risque],
                          border: `1.5px solid ${RISQUE_BORDER[prediction.niveau_risque]}`,
                          borderRadius: 8, padding: '0.75rem' }}>
                        <p style={{ margin: '0 0 2px', fontSize: 10, color: couleur, fontWeight: 700,
                          textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Niveau de risque</p>
                        {prediction.niveau_risque === 'élevé' ? (
                          <motion.p animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                            style={{ margin: 0, fontSize: 22, fontWeight: 900, color: couleur }}>
                            {prediction.niveau_risque.toUpperCase()}
                          </motion.p>
                        ) : (
                          <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: couleur }}>
                            {prediction.niveau_risque.toUpperCase()}
                          </p>
                        )}
                      </motion.div>
                    </div>
                  </div>
                </motion.div>

                {/* Résultat prédiction */}
                <SpotlightCard style={{ background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '1.25rem 1.4rem' }}>
                  <p style={{ margin: '0 0 1rem', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    Résultat de la prédiction
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.75rem 1rem',
                        background: prediction.prediction_binaire === 1 ? 'var(--danger-bg)' : 'var(--success-bg)',
                        border: `1px solid ${prediction.prediction_binaire === 1 ? 'var(--danger-border)' : 'var(--success-border)'}`,
                        borderRadius: 8 }}>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' as const }}>
                          Turnover prévu
                        </p>
                        <p style={{ margin: 0, fontSize: 18, fontWeight: 900,
                          color: prediction.prediction_binaire === 1 ? 'var(--danger)' : 'var(--success)' }}>
                          {prediction.prediction_binaire === 1 ? 'Oui, risque de départ' : 'Non, situation stable'}
                        </p>
                      </div>
                      <motion.div animate={prediction.prediction_binaire === 1 ? { y: [0, -3, 0] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}>
                        {prediction.prediction_binaire === 1
                          ? <TrendingUp  size={28} color="var(--danger)"  />
                          : <TrendingDown size={28} color="var(--success)" />}
                      </motion.div>
                    </motion.div>

                    {[
                      ['Probabilité', prediction.pourcentage],
                      ['Niveau de risque', null],
                      ['Seuil de décision', `${(prediction.seuil * 100).toFixed(1)}%`],
                    ].map(([label, value], i) => (
                      <motion.div key={label as string}
                        initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + i * 0.07 }}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 7,
                          border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
                        {label === 'Niveau de risque'
                          ? getRisqueBadge(prediction.niveau_risque)
                          : <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{value}</span>}
                      </motion.div>
                    ))}

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Score de risque</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: couleur }}>{pct}%</span>
                      </div>
                      <div style={{ height: 8, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
                          style={{ height: '100%', borderRadius: 6, background: couleur }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                        <span style={{ fontSize: 9, color: 'var(--success)' }}>Faible</span>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Seuil : {(prediction.seuil * 100).toFixed(0)}%</span>
                        <span style={{ fontSize: 9, color: 'var(--danger)' }}>Élevé</span>
                      </div>
                    </div>
                  </div>
                </SpotlightCard>
              </div>
            </Reveal>

            {/* ── Section 5 : Analyse de survie ── */}
            {survivalData?.survival_disponible && (
              <Reveal delay={0.15}>
                <SpotlightCard style={{ background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '1.25rem 1.4rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    Analyse de survie — Date estimée de départ
                  </p>
                  <p style={{ margin: '0 0 1rem', fontSize: 11, color: 'var(--text-muted)' }}>
                    Méthode : {survivalData.source ?? 'Weibull'} · IC à 25–75%
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      style={{ background: RISQUE_BG[prediction.niveau_risque],
                        border: `1.5px solid ${RISQUE_BORDER[prediction.niveau_risque]}`,
                        borderRadius: 8, padding: '1rem', textAlign: 'center' }}>
                      <Calendar size={18} color={couleur} style={{ marginBottom: 6 }} />
                      <p style={{ margin: '0 0 2px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700,
                        textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Date estimée</p>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: couleur }}>{survivalData.date_estimee}</p>
                    </motion.div>
                  </div>
                  {courbe.length > 0 && (
                    <div>
                      <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                        Courbe de survie S(t) — Probabilité de rester en poste au fil du temps
                      </p>
                      <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={courbe} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id="survGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor={couleur} stopOpacity={0.25} />
                              <stop offset="95%" stopColor={couleur} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="mois" {...axisProps} label={{ value: 'Mois', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: 'var(--text-muted)' }} />
                          <YAxis {...axisProps} domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                          <ReferenceLine y={0.5} stroke="var(--text-muted)" strokeDasharray="4 4"
                            label={{ value: 'Médiane', fontSize: 9, fill: 'var(--text-muted)', position: 'insideTopRight' }} />
                          {survivalData.delai_mois && (
                            <ReferenceLine x={Math.round(survivalData.delai_mois)} stroke={couleur} strokeDasharray="4 4"
                              label={{ value: `~${survivalData.delai_mois}m`, fontSize: 9, fill: couleur, position: 'insideTopRight' }} />
                          )}
                          <Tooltip formatter={(v: any) => [`${Math.round(v * 100)}%`, 'Probabilité de rester']}
                            labelFormatter={(l: any) => `Mois ${l}`}
                            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', fontSize: 11 }} />
                          <Area type="monotone" dataKey="survie" stroke={couleur} strokeWidth={2}
                            fill="url(#survGrad)" dot={false} animationDuration={1000} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </SpotlightCard>
              </Reveal>
            )}

            {/* ── Section 6 : Facteurs SHAP premium ── */}
            {contributions.length > 0 && (
              <Reveal delay={0.2}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                  {/* Facteurs augmentant le risque */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                    style={{ background: 'linear-gradient(135deg, var(--danger-bg) 0%, var(--card) 100%)',
                      border: '1px solid var(--danger-border)', borderRadius: 'var(--radius)',
                      padding: '1.25rem 1.4rem', position: 'relative', overflow: 'hidden' }}
                  >
                    {/* Accent décoratif */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                      background: 'linear-gradient(90deg, var(--danger), transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(220,38,38,0.15)',
                        border: '1px solid rgba(220,38,38,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUp size={14} color="var(--danger)" />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--danger)',
                          textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Facteurs augmentant le risque</p>
                        <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>
                          {increasing.length} facteur{increasing.length > 1 ? 's' : ''} identifié{increasing.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {increasing.length === 0
                        ? <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Rien à signaler ici.</p>
                        : increasing.map((c: any, i: number) => (
                          <SHAPFactorCard key={i}
                            label={cleanFeatureName(c.feature)}
                            shapValue={c.shap_value}
                            maxShap={maxShap}
                            direction="augmente"
                            index={i}
                          />
                        ))}
                    </div>
                  </motion.div>

                  {/* Facteurs réduisant le risque */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.08 }}
                    style={{ background: 'linear-gradient(135deg, var(--success-bg) 0%, var(--card) 100%)',
                      border: '1px solid var(--success-border)', borderRadius: 'var(--radius)',
                      padding: '1.25rem 1.4rem', position: 'relative', overflow: 'hidden' }}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                      background: 'linear-gradient(90deg, var(--success), transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingDown size={14} color="var(--success)" />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: 'var(--success)',
                          textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Facteurs réduisant le risque</p>
                        <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>
                          {decreasing.length} facteur{decreasing.length > 1 ? 's' : ''} protecteur{decreasing.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {decreasing.length === 0
                        ? <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Aucun facteur favorable détecté.</p>
                        : decreasing.map((c: any, i: number) => (
                          <SHAPFactorCard key={i}
                            label={cleanFeatureName(c.feature)}
                            shapValue={c.shap_value}
                            maxShap={maxShap}
                            direction="diminue"
                            index={i}
                          />
                        ))}
                    </div>
                  </motion.div>
                </div>
              </Reveal>
            )}

            {/* ── Section 7 : Visualisation SHAP ── */}
            {chartData.length > 0 && (
              <Reveal delay={0.25}>
                <SpotlightCard style={{ background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '1.25rem 1.4rem' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    Visualisation SHAP — Contributions par variable
                  </p>
                  <p style={{ margin: '0 0 1rem', fontSize: 11, color: 'var(--text-muted)' }}>
                    Rouge = augmente le risque, vert = le réduit. Barres triées par impact absolu.
                  </p>
                  <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 34)}>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" {...axisProps} tickFormatter={(v: number) => v.toFixed(3)} />
                      <YAxis type="category" dataKey="feature" {...axisProps} width={220} />
                      <ReferenceLine x={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
                      <Tooltip content={<ChartTooltip />}
                        formatter={(v: any, _: any, props: any) => {
                          const d = props.payload;
                          return [`${d.raw > 0 ? '+' : ''}${d.raw.toFixed(4)} (${d.direction === 'augmente' ? '↑ risque' : '↓ risque'})`, 'SHAP'];
                        }} />
                      <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={20} animationDuration={800} animationBegin={100}>
                        {chartData.map((d: any, i: number) => (
                          <Cell key={i} fill={d.direction === 'augmente' ? 'var(--danger)' : 'var(--success)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 10 }}>
                    {[['var(--danger)', '↑ Augmente le risque'], ['var(--success)', '↓ Réduit le risque']].map(([c, l]) => (
                      <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
                      </div>
                    ))}
                  </div>
                </SpotlightCard>
              </Reveal>
            )}

            {/* ── Section 8 : Recommandation RH ── */}
            {recoGlobale && (
              <Reveal delay={0.3}>
                <motion.div style={{ background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '1.25rem 1.4rem',
                  position: 'relative', overflow: 'hidden',
                  boxShadow: `0 0 20px ${RISQUE_GLOW[prediction.niveau_risque]}` }}>
                  <BorderBeam color={BEAM_COLOR[prediction.niveau_risque]} duration={6} />
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <p style={{ margin: '0 0 0.5rem', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      Recommandation RH
                    </p>
                    <p style={{ margin: '0 0 1rem', fontSize: 11, color: 'var(--text-muted)' }}>
                      Plan d'action personnalisé basé sur la prédiction et l'analyse SHAP
                    </p>
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12,
                        background: recoGlobale.bg, border: `1.5px solid ${recoGlobale.border}`,
                        borderRadius: 'var(--radius)', padding: '1rem 1.25rem' }}>
                      <motion.div
                        animate={prediction.niveau_risque === 'élevé' ? { rotate: [0, -5, 5, 0] } : {}}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}>
                        <ClipboardList size={22} color={recoGlobale.couleur} style={{ flexShrink: 0 }} />
                      </motion.div>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 900, color: recoGlobale.couleur }}>
                          {recoGlobale.titre}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text)' }}>{recoGlobale.message}</p>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              </Reveal>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── État initial ── */}
      {!prediction && !loading && <EmptyState />}
    </div>
  );
}