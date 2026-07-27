// src/components/ui/Icons.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Set d'icônes maison — remplace lucide-react dans toute l'application.
// Tracé géométrique cohérent : grille 24, trait 1.7 par défaut, jointures
// arrondies, sans remplissage (sauf pivot/points pleins ponctuels).
// API compatible avec l'usage existant (`size`, `color`, `strokeWidth`,
// props SVG natives type `aria-hidden`, `style`, `title`…) pour ne pas avoir
// à retoucher les sites d'appel au-delà de l'import.
// ─────────────────────────────────────────────────────────────────────────────

import { SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function svgProps({ size = 16, color = 'currentColor', strokeWidth = 1.7, ...rest }: IconProps) {
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const,
    stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    ...rest,
  };
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M19.5 19.5 15.3 15.3" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M6 6 18 18M18 6 6 18" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 3.5c-3 0-5.1 2.2-5.1 5.3v3.2c0 1-.4 2-1.1 2.8l-.8.9h14l-.8-.9a3.9 3.9 0 0 1-1.1-2.8V8.8c0-3.1-2.1-5.3-5.1-5.3z" />
      <path d="M9.6 18.4a2.4 2.4 0 0 0 4.8 0" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M5.5 9 12 15.5 18.5 9" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M20 14.6A8.5 8.5 0 1 1 9.4 4 7 7 0 0 0 20 14.6z" />
    </svg>
  );
}

export function WifiIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M3.5 9a12 12 0 0 1 17 0" />
      <path d="M6.5 12.3a8 8 0 0 1 11 0" />
      <path d="M9.7 15.6a3.8 3.8 0 0 1 4.6 0" />
      <path d="M12 19h.01" strokeWidth={(props.strokeWidth ?? 1.7) + 0.8} />
    </svg>
  );
}

export function WifiOffIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M3.5 9a12 12 0 0 1 17 0" opacity={0.45} />
      <path d="M6.5 12.3a8 8 0 0 1 11 0" opacity={0.45} />
      <path d="M9.7 15.6a3.8 3.8 0 0 1 4.6 0" opacity={0.45} />
      <path d="M12 19h.01" strokeWidth={(props.strokeWidth ?? 1.7) + 0.8} />
      <path d="M3 3l18 18" />
    </svg>
  );
}

// grille de tuiles asymétrique — nav "Tableau de bord"
export function DashboardIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <rect x="4" y="4" width="7" height="7" rx="1.3" />
      <rect x="13" y="4" width="7" height="4.6" rx="1.3" />
      <rect x="13" y="11.4" width="7" height="8.6" rx="1.3" />
      <rect x="4" y="13.4" width="7" height="6.6" rx="1.3" />
    </svg>
  );
}

// cadran + aiguille — nav "Scoring Client" (remplace l'icône "cerveau" générique)
export function ScoreIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 16a8 8 0 0 1 16 0" />
      <path d="M12 16 16 11" />
      <circle cx="12" cy="16" r="1.3" fill={props.color ?? 'currentColor'} stroke="none" />
    </svg>
  );
}

// bulle de dialogue à trois points — nav "Assistant RH IA"
export function ChatIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 6.8A1.8 1.8 0 0 1 5.8 5h12.4A1.8 1.8 0 0 1 20 6.8v7.4a1.8 1.8 0 0 1-1.8 1.8H9.3L5 19.5v-3.5h-.2A1.8 1.8 0 0 1 4 14.2z" />
      <path d="M8.6 10.3h.01M12 10.3h.01M15.4 10.3h.01" strokeWidth={(props.strokeWidth ?? 1.7) + 0.7} />
    </svg>
  );
}

// trois rails à curseur — nav "Paramètres" (alternative au rouage générique)
export function SettingsIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
      <circle cx="9" cy="6.5" r="2" fill="var(--card, #fff)" />
      <circle cx="15" cy="12" r="2" fill="var(--card, #fff)" />
      <circle cx="7.5" cy="17.5" r="2" fill="var(--card, #fff)" />
    </svg>
  );
}

// barres ascendantes — marque du logo
export function ChartBarsIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 19V11M10 19V5M16 19v-7.5M20.5 19H3.5" />
    </svg>
  );
}

export function TrendingUpIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M3 17l7-7 4 4 7-7" />
      <path d="M16 7h5v5" />
    </svg>
  );
}

export function TrendingDownIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M3 7l7 7 4-4 7 7" />
      <path d="M16 17h5v-5" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 4v11.5M7.5 11l4.5 4.5L16.5 11" />
      <path d="M5 18.5h14" />
    </svg>
  );
}

// document avec coin replié + lignes — export CSV
export function FileCsvIcon(props: IconProps) {
  return (
    <svg {...svgProps({ color: 'var(--success, #16A34A)', ...props })}>
      <path d="M6.8 3.5h7l4 4v11.2a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 18.5V5.3a1.8 1.8 0 0 1 1.8-1.8z" />
      <path d="M13.8 3.5v4h4" />
      <path d="M8.3 14.8h7.4M8.3 17.8h7.4" />
    </svg>
  );
}

// document avec coin replié + bloc plein — export PDF
export function FilePdfIcon(props: IconProps) {
  return (
    <svg {...svgProps({ color: 'var(--danger, #DC2626)', ...props })}>
      <path d="M6.8 3.5h7l4 4v11.2a1.8 1.8 0 0 1-1.8 1.8H6.8A1.8 1.8 0 0 1 5 18.5V5.3a1.8 1.8 0 0 1 1.8-1.8z" />
      <path d="M13.8 3.5v4h4" />
      <rect x="8.1" y="13.4" width="3.2" height="4.6" rx="1" />
      <path d="M13.4 13.4h2M13.4 15.8h2M17.9 13.4v4.6" />
    </svg>
  );
}

// KPI "Effectif"
export function UsersIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M15.5 6a2.7 2.7 0 0 1 0 5.3M19 20c0-2.6-1.6-4.5-3.8-5.2" />
    </svg>
  );
}

// KPI "Profils à risque" / alerte inline
export function AlertTriangleIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 3.5 21 19H3z" />
      <path d="M12 9.8v4M12 16.6h.01" strokeWidth={(props.strokeWidth ?? 1.7) + 0.4} />
    </svg>
  );
}

// KPI "Satisfaction"
export function StarIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 3.3l2.7 5.7 6.1.6-4.6 4.2 1.3 6.1-5.5-3.1-5.5 3.1 1.3-6.1-4.6-4.2 6.1-.6z" />
    </svg>
  );
}

// KPI "Salaire moyen"
export function DollarSignIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M12 2v20" />
      <path d="M17 6.9c0-2-2.2-3.3-5-3.3S7 5 7 7.3c0 2.2 2 3 5 3.7s5 1.4 5 3.6c0 2.3-2.2 3.4-5 3.4s-5.3-1.2-5.3-3.4" />
    </svg>
  );
}

// KPI "Ancienneté moyenne"
export function ClockIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.3V12l3.3 2" />
    </svg>
  );
}

// info-bulle
export function InfoIcon(props: IconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 7.6h.01" strokeWidth={(props.strokeWidth ?? 1.7) + 0.6} />
    </svg>
  );
}