export function ChartTooltip({ active, payload, label, unit = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px',
      fontSize: 12, boxShadow: 'var(--shadow-md)',
      color: 'var(--text)'
    }}>
      {label && <p style={{ margin: '0 0 4px', color: 'var(--text-muted)', fontSize: 11 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ margin: 0, fontWeight: 600 }}>
          {p.name ? `${p.name}: ` : ''}{p.value}{unit}
        </p>
      ))}
    </div>
  );
}