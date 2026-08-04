import { useState, useRef, useEffect } from 'react';
import {
  Save, RefreshCw, CheckCircle, XCircle, Loader,
  ChevronDown, GitBranch, Database,
  Cpu, Activity, Shield, Zap,
} from 'lucide-react';
import { getMonitoring, getModelInfo, getMetrics, getDrift, getMlflowSummary, getMlflowRun } from '../api/client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useInView } from 'framer-motion';

type ConnStatus = 'idle' | 'loading' | 'ok' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS PREMIUM — même système que AnalyseSHAP / Dashboard
// ─────────────────────────────────────────────────────────────────────────────

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

/** Halo lumineux orbital autour d'une card critique */
const BorderBeam = ({ color = 'var(--primary-light)', duration = 7 }: { color?: string; duration?: number }) => {
  const reduced = usePrefersReducedMotion();
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <motion.div
        style={{
          position: 'absolute',
          width: 70, height: '220%', top: '-60%',
          background: `conic-gradient(transparent 205deg, ${color}, transparent 360deg)`,
          filter: 'blur(2px)', opacity: 0.5,
        }}
        animate={reduced ? {} : { rotate: [0, 360] }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      />
      <div style={{ position: 'absolute', inset: 1, borderRadius: 'inherit', background: 'var(--card)', zIndex: 1 }} />
    </div>
  );
};

/** Spotlight : halo qui suit le curseur sur la card */
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
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.09) 0%, transparent 70%)',
        transform: `translate(${pos.x - 150}px, ${pos.y - 150}px)`,
        opacity, transition: 'opacity 0.3s ease', pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}

/** Reveal scroll — fade+slide+blur entrant */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });
  return (
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 22, filter: 'blur(4px)' }}
      animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.52, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

/** Compteur animé (identique Dashboard) */
function AnimatedNumber({ value, suffix = '', prefix = '', decimals }: {
  value: number; suffix?: string; prefix?: string; decimals?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [displayed, setDisplayed] = useState(0);
  const dec = decimals ?? (Number.isInteger(value) ? 0 : 1);

  useEffect(() => {
    if (!inView) return;
    const duration = 900;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(eased * value);
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

/** Barre de progression animée avec shimmer */
const AnimatedBar = ({ pct, color }: { pct: number; color: string }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} style={{ height: 5, background: 'var(--border)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={inView ? { width: `${pct}%` } : {}}
        transition={{ duration: 0.9, ease: [0.34, 1.26, 0.64, 1] }}
        style={{ height: '100%', borderRadius: 6, background: color, boxShadow: `0 0 6px ${color}66`, position: 'relative' }}
      >
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.4, delay: 0.9, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
            borderRadius: 6,
          }}
        />
      </motion.div>
    </div>
  );
};

/** Label de section — barre colorée + texte uppercase */
const SectionLabel = ({ icon: Icon, children, color = 'var(--primary-light)' }: {
  icon?: any; children: string; color?: string;
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.2rem' }}>
    {Icon && (
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: `${color}18`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={13} color={color} />
      </div>
    )}
    <motion.div
      initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{ width: 3, height: 14, background: color, borderRadius: 2, transformOrigin: 'left', flexShrink: 0 }}
    />
    <p style={{
      margin: 0, fontSize: 10, fontWeight: 700, color,
      textTransform: 'uppercase' as const, letterSpacing: '0.1em',
    }}>
      {children}
    </p>
  </div>
);

/** InfoRow — ligne clé/valeur avec hover premium */
function InfoRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const [hov, setHov] = useState(false);
  const c = accent ?? 'var(--primary-light)';
  return (
    <motion.div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      whileHover={{ y: -1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: hov ? `${c}0a` : 'var(--bg-subtle)',
        border: `1px solid ${hov ? `${c}28` : 'var(--border)'}`,
        borderRadius: 8, padding: '9px 13px',
        transition: 'background 0.18s, border-color 0.18s',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <motion.div
        animate={{ opacity: hov ? 1 : 0 }}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: c, borderRadius: '0 2px 2px 0' }}
      />
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
      <span style={{
        fontSize: 11.5, fontWeight: 700,
        color: hov ? c : 'var(--text)',
        transition: 'color 0.18s',
      }}>{value}</span>
    </motion.div>
  );
}

/** Metric pill — carré de stat grande valeur */
function MetricPill({ label, value, suffix = '', color, icon: Icon, pct }: {
  label: string; value: number; suffix?: string; color: string; icon?: any; pct?: number;
}) {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      whileHover={{ y: -2, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      style={{
        background: 'var(--card)', border: `1px solid ${hov ? `${color}44` : 'var(--border)'}`,
        borderRadius: 10, padding: '14px 16px',
        boxShadow: hov ? `0 6px 24px ${color}1a` : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <motion.div
        animate={{ opacity: hov ? 1 : 0.3 }}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />
      {Icon && (
        <div style={{
          width: 24, height: 24, borderRadius: 6, background: `${color}18`,
          border: `1px solid ${color}28`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', marginBottom: 8,
        }}>
          <Icon size={12} color={color} />
        </div>
      )}
      <p style={{ margin: '0 0 1px', fontSize: 9.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </p>
      <p style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>
        <AnimatedNumber value={value} suffix={suffix} decimals={1} />
      </p>
      {pct !== undefined && <AnimatedBar pct={pct} color={color} />}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function Parametres() {
  const [apiUrl,     setApiUrl]     = useState('http://localhost:8000');
  const [saved,      setSaved]      = useState(false);
  const [connStatus, setConnStatus] = useState<ConnStatus>('idle');
  const [connMsg,    setConnMsg]    = useState('');

  const { data: modelInfoRes } = useQuery({ queryKey: ['model-info'],  queryFn: getModelInfo  });
  const { data: metricsRes   } = useQuery({ queryKey: ['api-metrics'], queryFn: getMetrics    });
  const { data: driftRes     } = useQuery({ queryKey: ['drift'],       queryFn: getDrift, staleTime: 60_000 });

  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const {
    data: mlflowRes, isLoading: mlflowLoading, isFetching: mlflowFetching, refetch: refetchMlflow,
  } = useQuery({ queryKey: ['mlflow-summary'], queryFn: getMlflowSummary, staleTime: 30_000 });
  const { data: runDetailRes, isLoading: runDetailLoading } = useQuery({
    queryKey: ['mlflow-run', expandedRunId],
    queryFn: () => getMlflowRun(expandedRunId as string),
    enabled: expandedRunId !== null,
  });

  const mlflowData = mlflowRes?.data;
  const runDetail  = runDetailRes?.data;
  const modelInfo  = modelInfoRes?.data;
  const metrics    = metricsRes?.data;
  const tech       = metrics?.technical_metrics ?? {};
  const drift      = driftRes?.data;

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const handleTestConnection = async () => {
    setConnStatus('loading'); setConnMsg('');
    try {
      const r = await getMonitoring();
      const d = r.data;
      setConnStatus('ok');
      setConnMsg(`API v${d.api_version} · ${d.predictions_count} prédictions · modèle ${d.model_loaded ? 'chargé ✓' : 'absent ✗'}`);
    } catch (e: any) {
      setConnStatus('error');
      setConnMsg(e?.message ?? 'Connexion impossible — vérifiez que le backend est démarré sur le port 8000');
    }
  };

  const fmtPct = (v: number | null | undefined) => v != null ? `${(v * 100).toFixed(1)} %` : '—';

  const datasetInfos: [string, string][] = [
    ['Dataset',        'IBM HR Analytics Employee Attrition'],
    ['Fichier',        'WA_Fn-UseC_-HR-Employee-Attrition.csv'],
    ['Employés',       '1 470 enregistrements'],
    ['Variables',      '35 colonnes'],
    ['Variable cible', 'Attrition (Yes / No)'],
    ['Modèle ML',      modelInfo?.model_name ?? 'Random Forest Classifier'],
    ['Version',        modelInfo?.version    ?? '—'],
    ['Seuil optimal',  modelInfo?.threshold  != null ? String(modelInfo.threshold) : '—'],
  ];

  const perfMetrics = metrics && !metrics.error ? [
    { label: 'AUC-ROC',   value: (tech.roc_auc   ?? 0) * 100, color: '#6366f1', icon: Activity },
    { label: 'F1-score',  value: (tech.f1        ?? 0) * 100, color: '#10b981', icon: Zap      },
    { label: 'Recall',    value: (tech.recall    ?? 0) * 100, color: '#f59e0b', icon: Shield   },
    { label: 'Précision', value: (tech.precision ?? 0) * 100, color: '#3b82f6', icon: Cpu      },
  ] : [
    { label: 'AUC-ROC',   value: 0, color: '#6366f1', icon: Activity },
    { label: 'F1-score',  value: 0, color: '#10b981', icon: Zap      },
    { label: 'Recall',    value: 0, color: '#f59e0b', icon: Shield   },
    { label: 'Précision', value: 0, color: '#3b82f6', icon: Cpu      },
  ];

  const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
    FINISHED:  { bg: '#DCFCE7', color: '#15803D', label: 'Terminé'   },
    RUNNING:   { bg: '#DBEAFE', color: '#1D4ED8', label: 'En cours'  },
    FAILED:    { bg: '#FEE2E2', color: '#B91C1C', label: 'Échoué'    },
    SCHEDULED: { bg: '#FEF9C3', color: '#A16207', label: 'Planifié'  },
  };

  const inputBaseStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1.5px solid var(--border)', fontSize: 13, outline: 'none',
    color: 'var(--text)', background: 'var(--card)', boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 720 }}>

      {/* ── En-tête ── */}
      <Reveal>
        <div>
          <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, color: 'var(--primary-light)',
            textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            HR Analytics Platform
          </p>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--text)', fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.02em' }}>
            Paramètres
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
            Configuration, modèle, métriques et suivi MLflow
          </p>
        </div>
      </Reveal>

      {/* ── Configuration API ── */}
      <Reveal delay={0.05}>
        <SpotlightCard style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '1.5rem 1.6rem',
          boxShadow: 'var(--shadow-xs)', position: 'relative', overflow: 'hidden',
        }}>
          {/* Subtle grid background */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.02,
            backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: '32px 32px', pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <SectionLabel icon={Zap}>Configuration API</SectionLabel>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                URL de l&apos;API FastAPI
              </label>
              <input
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
                style={inputBaseStyle}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary-light)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <motion.button
                onClick={handleSave}
                whileHover={{ scale: 1.03, boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}
                whileTap={{ scale: 0.96 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: saved
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
                  color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'background 0.25s',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.span key={saved ? 'saved' : 'save'}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Save size={13} /> {saved ? 'Sauvegardé !' : 'Sauvegarder'}
                  </motion.span>
                </AnimatePresence>
              </motion.button>

              <motion.button
                onClick={handleTestConnection}
                disabled={connStatus === 'loading'}
                whileHover={connStatus !== 'loading' ? { scale: 1.02 } : {}}
                whileTap={connStatus !== 'loading' ? { scale: 0.97 } : {}}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg-subtle)', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 8, padding: '9px 16px',
                  fontSize: 13, fontWeight: 600,
                  cursor: connStatus === 'loading' ? 'not-allowed' : 'pointer',
                  opacity: connStatus === 'loading' ? 0.7 : 1, transition: 'all 0.2s',
                }}
              >
                <motion.span
                  animate={connStatus === 'loading' ? { rotate: 360 } : { rotate: 0 }}
                  transition={{ duration: 0.9, repeat: connStatus === 'loading' ? Infinity : 0, ease: 'linear' }}
                  style={{ display: 'inline-flex' }}
                >
                  {connStatus === 'loading' ? <Loader size={13} /> : <RefreshCw size={13} />}
                </motion.span>
                Tester la connexion
              </motion.button>
            </div>

            {/* Feedback connexion */}
            <AnimatePresence>
              {connStatus !== 'idle' && connStatus !== 'loading' && connMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'center', gap: 8,
                    background: connStatus === 'ok' ? 'var(--success-bg)' : 'var(--danger-bg)',
                    border: `1px solid ${connStatus === 'ok' ? 'var(--success-border)' : 'var(--danger-border)'}`,
                    borderRadius: 8, padding: '0.625rem 0.875rem', fontSize: 12,
                    color: connStatus === 'ok' ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}
                >
                  {connStatus === 'ok'
                    ? <CheckCircle size={14} />
                    : <XCircle size={14} />}
                  {connMsg}
                </motion.div>
              )}
              {connStatus === 'loading' && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ margin: '0.6rem 0 0', fontSize: 12, color: 'var(--text-muted)' }}
                >
                  Connexion en cours…
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </SpotlightCard>
      </Reveal>

      {/* ── Dataset & Modèle ── */}
      <Reveal delay={0.1}>
        <SpotlightCard style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '1.5rem 1.6rem',
          boxShadow: 'var(--shadow-xs)',
        }}>
          <SectionLabel icon={Database}>Dataset &amp; Modèle</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            {datasetInfos.map(([k, v], i) => (
              <motion.div key={k}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * i, type: 'spring', stiffness: 280, damping: 22 }}
              >
                <InfoRow label={k} value={v} />
              </motion.div>
            ))}
          </div>
        </SpotlightCard>
      </Reveal>

      {/* ── Performances du modèle ── */}
      <Reveal delay={0.15}>
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '1.5rem 1.6rem',
          boxShadow: 'var(--shadow-xs)', position: 'relative', overflow: 'hidden',
        }}>
          <BorderBeam color="#6366f1" duration={10} />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <SectionLabel icon={Activity}>Performances du modèle</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {perfMetrics.map((m, i) => (
                <motion.div key={m.label}
                  initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.06 * i, type: 'spring', stiffness: 300, damping: 22 }}
                >
                  <MetricPill
                    label={m.label}
                    value={m.value}
                    suffix=" %"
                    color={m.color}
                    icon={m.icon}
                    pct={m.value}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ── MLflow — Suivi des expériences ── */}
      <Reveal delay={0.2}>
        <SpotlightCard style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '1.5rem 1.6rem',
          boxShadow: 'var(--shadow-xs)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
            <SectionLabel icon={GitBranch}>MLflow — Suivi des expériences</SectionLabel>
            <motion.button
              onClick={() => refetchMlflow()}
              disabled={mlflowFetching}
              whileHover={!mlflowFetching ? { scale: 1.05 } : {}}
              whileTap={!mlflowFetching ? { scale: 0.95 } : {}}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'transparent', color: 'var(--text-muted)', border: 'none',
                fontSize: 12, fontWeight: 600, cursor: mlflowFetching ? 'not-allowed' : 'pointer',
                padding: '4px 8px', borderRadius: 6,
              }}
            >
              <motion.span
                animate={mlflowFetching ? { rotate: 360 } : { rotate: 0 }}
                transition={{ duration: 0.9, repeat: mlflowFetching ? Infinity : 0, ease: 'linear' }}
                style={{ display: 'inline-flex' }}
              >
                <RefreshCw size={12} />
              </motion.span>
              Actualiser
            </motion.button>
          </div>

          <AnimatePresence mode="wait">
            {mlflowLoading && (
              <motion.div key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '1rem 0' }}>
                <div style={{ position: 'relative', width: 28, height: 28 }}>
                  {[0, 1].map(i => (
                    <motion.div key={i}
                      style={{ position: 'absolute', inset: i * 4, border: '2px solid transparent',
                        borderTopColor: i === 0 ? 'var(--primary-light)' : 'var(--warning)',
                        borderRadius: '50%' }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.9 + i * 0.3, repeat: Infinity, ease: 'linear' }}
                    />
                  ))}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Chargement des runs MLflow…</p>
              </motion.div>
            )}

            {!mlflowLoading && mlflowData?.error && (
              <motion.p key="error"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>
                MLflow indisponible : {mlflowData.error}
              </motion.p>
            )}

            {!mlflowLoading && !mlflowData?.error && (
              <motion.div key="content"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}>
                {/* Résumé expérience */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '1rem' }}>
                  <InfoRow label="Expérience" value={mlflowData?.experiment_name ?? '—'} />
                  <InfoRow label="Runs enregistrés" value={String(mlflowData?.total_runs ?? 0)} />
                </div>

                {(!mlflowData?.latest_runs || mlflowData.latest_runs.length === 0) ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
                    Aucun run trouvé. Lance un entraînement (train.py / run_all.py) pour voir l&apos;historique ici.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mlflowData.latest_runs.map((run: any, idx: number) => {
                      const st = statusStyle[run.status] ?? { bg: '#F1F5F9', color: '#475569', label: run.status };
                      const isOpen = expandedRunId === run.run_id;
                      return (
                        <motion.div key={run.run_id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 * idx, type: 'spring', stiffness: 280, damping: 22 }}
                          style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}
                        >
                          <motion.div
                            onClick={() => setExpandedRunId(isOpen ? null : run.run_id)}
                            whileHover={{ background: 'var(--bg-subtle)' }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                              cursor: 'pointer', background: isOpen ? 'var(--bg-subtle)' : 'var(--card)',
                              transition: 'background 0.15s',
                            }}
                          >
                            <motion.div
                              animate={isOpen ? { rotate: 10 } : { rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            >
                              <GitBranch size={13} color="var(--text-muted)" />
                            </motion.div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {run.run_name || `Run ${run.run_id.slice(0, 8)}`}
                              </p>
                              <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>
                                {run.start_time
                                  ? new Date(run.start_time).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
                                  : '—'}
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                              {run.metrics?.roc_auc != null && (
                                <span style={{ fontVariantNumeric: 'tabular-nums' }}>AUC {fmtPct(run.metrics.roc_auc)}</span>
                              )}
                              {run.metrics?.f1 != null && (
                                <span style={{ fontVariantNumeric: 'tabular-nums' }}>F1 {fmtPct(run.metrics.f1)}</span>
                              )}
                            </div>
                            <span style={{
                              padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                              background: st.bg, color: st.color,
                            }}>
                              {st.label}
                            </span>
                            <motion.div
                              animate={isOpen ? { rotate: 180 } : { rotate: 0 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                            >
                              <ChevronDown size={13} color="var(--text-muted)" />
                            </motion.div>
                          </motion.div>

                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderTop: '1px solid var(--border)' }}>
                                  {runDetailLoading ? (
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Chargement du détail…</p>
                                  ) : runDetail?.error ? (
                                    <p style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>{runDetail.error}</p>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                      <div>
                                        <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: 'var(--primary-light)',
                                          textTransform: 'uppercase', letterSpacing: '0.08em' }}>Métriques</p>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
                                          {Object.entries(runDetail?.metrics ?? {}).map(([k, v]: [string, any], mi) => (
                                            <motion.div key={k}
                                              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                                              transition={{ delay: 0.03 * mi }}
                                              style={{ background: 'var(--card)', borderRadius: 7, padding: '7px 10px',
                                                border: '1px solid var(--border)' }}>
                                              <p style={{ margin: 0, fontSize: 9.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k}</p>
                                              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>
                                                {typeof v === 'number' ? v.toFixed(4) : String(v)}
                                              </p>
                                            </motion.div>
                                          ))}
                                        </div>
                                      </div>
                                      {runDetail?.params && Object.keys(runDetail.params).length > 0 && (
                                        <div>
                                          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                                            textTransform: 'uppercase', letterSpacing: '0.08em' }}>Paramètres</p>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                            {Object.entries(runDetail.params).map(([k, v]: [string, any]) => (
                                              <motion.span key={k}
                                                whileHover={{ scale: 1.04 }}
                                                style={{ fontSize: 11, background: 'var(--card)', border: '1px solid var(--border)',
                                                  borderRadius: 6, padding: '3px 8px', color: 'var(--text)', cursor: 'default' }}>
                                                <strong style={{ color: 'var(--primary-light)' }}>{k}</strong>
                                                <span style={{ color: 'var(--text-muted)' }}> = </span>
                                                {String(v)}
                                              </motion.span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      <p style={{ margin: 0, fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'monospace', opacity: 0.6 }}>
                                        {run.run_id}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {mlflowData?.tracking_uri && (
                  <p style={{ margin: '12px 0 0', fontSize: 9.5, color: 'var(--text-muted)', fontFamily: 'monospace', opacity: 0.5 }}>
                    {mlflowData.tracking_uri}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </SpotlightCard>
      </Reveal>

      {/* ── Alerte Data Drift ── */}
      <AnimatePresence>
        {drift && !drift.error && (
          <Reveal delay={0.25}>
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                borderRadius: 'var(--radius-md)', padding: '1.2rem 1.4rem',
                display: 'flex', alignItems: 'flex-start', gap: 14,
                background: drift.action_required
                  ? 'linear-gradient(135deg, #FEF2F2 0%, var(--card) 100%)'
                  : 'linear-gradient(135deg, #F0FDF4 0%, var(--card) 100%)',
                border: `1.5px solid ${drift.action_required ? 'var(--danger-border)' : 'var(--success-border)'}`,
                boxShadow: `0 4px 20px ${drift.action_required ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.1)'}`,
                position: 'relative', overflow: 'hidden',
              }}
            >
              {/* Top accent bar */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: drift.action_required
                  ? 'linear-gradient(90deg, var(--danger), transparent)'
                  : 'linear-gradient(90deg, var(--success), transparent)',
              }} />

              {/* Icône pulsante */}
              <motion.div
                animate={drift.action_required
                  ? { scale: [1, 1.1, 1], boxShadow: ['0 0 0 0 rgba(239,68,68,0.3)', '0 0 0 8px rgba(239,68,68,0)', '0 0 0 0 rgba(239,68,68,0)'] }
                  : {}}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: drift.action_required ? '#FEE2E2' : '#DCFCE7',
                  border: `1.5px solid ${drift.action_required ? '#FECACA' : '#BBF7D0'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                {drift.action_required ? '⚠️' : '✅'}
              </motion.div>

              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700,
                  color: drift.action_required ? 'var(--danger)' : 'var(--success)' }}>
                  Data Drift — {drift.action_required ? 'Réentraînement recommandé' : 'Modèle stable'}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: drift.action_required ? 'var(--danger)' : 'var(--success)', lineHeight: 1.6, opacity: 0.85 }}>
                  {drift.drifted_features ?? 0} feature(s) avec drift détecté
                  · Taux : {drift.drift_rate != null ? `${(drift.drift_rate * 100).toFixed(0)} %` : '—'}
                  {drift.feature_drift_alert && ' · Drift données significatif'}
                  {drift.prediction_drift_alert && ' · Drift prédictions détecté'}
                </p>
              </div>

              <motion.span
                whileHover={{ scale: 1.05 }}
                style={{
                  flexShrink: 0, padding: '3px 10px', borderRadius: 6,
                  fontSize: 10, fontWeight: 700,
                  background: drift.action_required ? '#FEE2E2' : '#DCFCE7',
                  color: drift.action_required ? '#B91C1C' : '#15803D',
                  border: `1px solid ${drift.action_required ? '#FECACA' : '#BBF7D0'}`,
                }}
              >
                {drift.action_required ? 'ACTION REQUISE' : 'STABLE'}
              </motion.span>
            </motion.div>
          </Reveal>
        )}
      </AnimatePresence>

      {/* ── À propos ── */}
      <Reveal delay={0.3}>
        <motion.div
          whileHover={{ boxShadow: '0 12px 40px rgba(30,58,95,0.25)' }}
          transition={{ duration: 0.3 }}
          style={{
            background: 'linear-gradient(135deg, #1E3A5F 0%, #1a2f4e 100%)',
            borderRadius: 'var(--radius-md)', padding: '1.6rem',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Subtle grid */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '28px 28px', pointerEvents: 'none',
          }} />
          {/* Glow orb */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.28, 0.15] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', right: -40, top: -40,
              width: 160, height: 160, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)',
              filter: 'blur(20px)', pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
              HR Analytics Platform
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: 'rgba(255,255,255,0.58)', lineHeight: 1.7 }}>
              Application d&apos;aide à la décision RH basée sur le machine learning et l&apos;IA générative.
              Développée dans le cadre d&apos;un mémoire de Master 2 en Informatique de Gestion.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }}
              />
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
                Mahamat Haroun Ibrahim · UCAO Sénégal · 2026
              </p>
            </div>
          </div>
        </motion.div>
      </Reveal>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}