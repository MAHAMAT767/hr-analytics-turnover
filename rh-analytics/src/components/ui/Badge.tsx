type Variant = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

const STYLES: Record<Variant, { bg: string; color: string; border: string }> = {
  success: { bg: 'var(--success-bg)',  color: 'var(--success)',  border: 'var(--success-border)' },
  warning: { bg: 'var(--warning-bg)',  color: 'var(--warning)',  border: 'var(--warning-border)' },
  danger:  { bg: 'var(--danger-bg)',   color: 'var(--danger)',   border: 'var(--danger-border)'  },
  neutral: { bg: 'var(--neutral-bg)',  color: 'var(--neutral)',  border: 'var(--neutral-border)' },
  info:    { bg: 'var(--info-bg)',     color: 'var(--info)',     border: 'var(--info-border)'    },
};

interface Props { label: string; variant: Variant; }

export function Badge({ label, variant }: Props) {
  const s = STYLES[variant];
  return (
    <span
      role="status"
      style={{
        background:    s.bg,
        color:         s.color,
        border:        `1px solid ${s.border}`,
        borderRadius:  'var(--radius-xs)',
        padding:       '2px 8px',
        fontSize:      12,
        fontWeight:    600,
        display:       'inline-block',
        letterSpacing: '0.02em',
        textTransform: 'uppercase' as const,
      }}
    >
      {label}
    </span>
  );
}

export function getRisqueBadge(niveau: string) {
  if (niveau === 'élevé') return <Badge label="ÉLEVÉ"  variant="danger"  />;
  if (niveau === 'moyen') return <Badge label="MOYEN"  variant="warning" />;
  return                         <Badge label="FAIBLE" variant="success" />;
}