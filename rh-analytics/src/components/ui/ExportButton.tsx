import { useState, useRef, useEffect } from 'react';
import { exportCSV, exportPDF, ReportData } from '../../utils/export';
import { DownloadIcon, ChevronDownIcon, FileCsvIcon, FilePdfIcon } from './Icons';

interface ExportOption {
  label:    string;
  type:     'csv' | 'pdf';
  data?:    any[];
  filename: string;
  targetId?:   string;
  reportData?: ReportData; // données structurées pour le PDF pro
}

interface Props {
  options: ExportOption[];
}

const Spinner = () => (
  <div style={{
    width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    animation: 'spin 0.7s linear infinite',
  }}/>
);

export function ExportButton({ options }: Props) {
  const [open,        setOpen]        = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleExport = async (opt: ExportOption) => {
    setOpen(false);
    setLoading(true);
    setLoadingType(opt.type);
    try {
      if (opt.type === 'csv' && opt.data) {
        exportCSV(opt.data, opt.filename);
      } else if (opt.type === 'pdf') {
        await exportPDF(
          opt.targetId ?? '',
          opt.filename,
          () => {},
          () => {},
          opt.reportData,
        );
      }
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div ref={ref} style={{ position: 'relative' }}>

        {/* Bouton principal */}
        <button
          onClick={() => setOpen(o => !o)}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: loading ? 'var(--primary-bg)' : 'var(--primary)',
            color: loading ? 'var(--primary-light)' : '#fff', border: 'none', borderRadius: 8,
            padding: '8px 14px', fontSize: 12.5, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
            boxShadow: loading ? 'none' : 'var(--shadow-sm)',
          }}
          onMouseEnter={e => { if (!loading) (e.currentTarget.style.filter = 'brightness(0.92)'); }}
          onMouseLeave={e => { if (!loading) (e.currentTarget.style.filter = 'none'); }}
        >
          {loading ? (
            <><Spinner />{loadingType === 'pdf' ? 'Génération PDF…' : 'Export…'}</>
          ) : (
            <><DownloadIcon size={13} />Exporter<ChevronDownIcon size={11} strokeWidth={2.3} /></>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: 'var(--shadow-lg)',
            minWidth: 220, zIndex: 200, overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 14px 6px',
              borderBottom: '1px solid var(--border)',
            }}>
              <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Format d'export
              </p>
            </div>
            <div style={{ padding: '4px 0 6px' }}>
              {options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleExport(opt)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    gap: 10, padding: '9px 14px', background: 'none',
                    border: 'none', fontSize: 12.5, fontWeight: 500,
                    color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  {/* Icône type */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: opt.type === 'csv' ? 'var(--success-bg)' : 'var(--danger-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {opt.type === 'csv' ? <FileCsvIcon size={14} /> : <FilePdfIcon size={14} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--text)', fontSize: 12.5 }}>
                      {opt.label}
                    </p>
                    <p style={{ margin: 0, fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
                      {opt.type === 'csv'
                        ? `${opt.data?.length?.toLocaleString('fr-FR') ?? 0} lignes · CSV`
                        : '3 pages · Rapport complet'}
                    </p>
                  </div>
                  {/* Flèche */}
                  <ChevronDownIcon size={12} strokeWidth={2.3} color="var(--text-muted)" style={{ transform: 'rotate(-90deg)' }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}