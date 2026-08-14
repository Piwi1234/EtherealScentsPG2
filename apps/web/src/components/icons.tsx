"use client";

// Íconos outline (trazo, nunca rellenos) para el sidebar. Dibujados a mano en vez de traer una
// librería nueva: son pocos y simples, no vale la pena la dependencia.

type IconProps = { className?: string };

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
}

export function CategoriesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l1.8 2.2H19.5A1.5 1.5 0 0 1 21 8.7v8.8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5V6.5Z" />
    </svg>
  );
}

export function BrandsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6.5 3.5h11A1.5 1.5 0 0 1 19 5v15.2a.5.5 0 0 1-.78.42L12 16.5l-6.22 4.12a.5.5 0 0 1-.78-.42V5a1.5 1.5 0 0 1 1.5-1.5Z" />
    </svg>
  );
}

export function AttributesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="1.8" />
      <circle cx="16" cy="12" r="1.8" />
      <circle cx="11" cy="18" r="1.8" />
    </svg>
  );
}

export function ProductsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z" />
      <path d="M3.5 7.5 12 12l8.5-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M9 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H9" />
      <path d="M14 15.5 18 12l-4-3.5" />
      <path d="M18 12H9" />
    </svg>
  );
}

export function ClientsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="9" cy="10.5" r="2.2" />
      <path d="M5.5 16c.6-2 2-3 3.5-3s2.9 1 3.5 3" />
      <line x1="14.5" y1="9.5" x2="18" y2="9.5" />
      <line x1="14.5" y1="12.5" x2="18" y2="12.5" />
    </svg>
  );
}

export function EmpresasIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4" y="7" width="10" height="14" rx="1" />
      <rect x="14" y="3" width="6" height="18" rx="1" />
      <line x1="7" y1="11" x2="7" y2="11.01" />
      <line x1="11" y1="11" x2="11" y2="11.01" />
      <line x1="7" y1="15" x2="7" y2="15.01" />
      <line x1="11" y1="15" x2="11" y2="15.01" />
    </svg>
  );
}

export function AlmacenesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3 10 12 4l9 6" />
      <path d="M5 9.5V20h14V9.5" />
      <line x1="9" y1="20" x2="9" y2="13" />
      <line x1="15" y1="20" x2="15" y2="13" />
      <line x1="9" y1="13" x2="15" y2="13" />
    </svg>
  );
}

export function StockIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M3.5 7.5 12 3l8.5 4.5-8.5 4.5-8.5-4.5Z" />
      <path d="M3.5 7.5v9L12 21l8.5-4.5v-9" />
      <line x1="12" y1="12" x2="12" y2="21" />
    </svg>
  );
}

export function ProformasIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 3.5h9l3 3V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M15 3.5V7h3" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="14.5" x2="16" y2="14.5" />
      <line x1="8" y1="18" x2="12.5" y2="18" />
    </svg>
  );
}

export function SeguimientoIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
      <path d="M8.5 8h7" />
      <path d="M7.5 12.5 9.5 14.5 12.5 11" />
      <path d="M14.5 13h2.5" />
      <path d="M8.5 17h8" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20" />
      <path d="M15.5 5.3a3.2 3.2 0 0 1 0 6.1" />
      <path d="M15.5 14.2a4.5 4.5 0 0 1 4.5 4.3V20" />
    </svg>
  );
}

export function ContabilidadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="15.5" cy="14.5" r="1.8" />
    </svg>
  );
}

export function CuentaIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v9M14.8 9.8c0-1.3-1.25-2.3-2.8-2.3s-2.8 1-2.8 2.1c0 3.1 5.6 1.6 5.6 4.6 0 1.2-1.25 2.2-2.8 2.2s-2.8-1-2.8-2.3" />
    </svg>
  );
}

export function ListIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

export function OrdersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 8h12l-1 12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M6 9.5 12 15l6-5.5" />
    </svg>
  );
}

export function RegistrosIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 7.5 12 3l8 4.5v2L12 14 4 9.5v-2Z" />
      <path d="M4 9.5v7L12 21l8-4.5v-7" />
      <path d="M12 14v7" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6M17.7 17.7l-1.6-1.6M7.9 7.9 6.3 6.3" />
    </svg>
  );
}

export function ExchangeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden="true">
      <path d="M4 8h13" />
      <path d="M14 4.5 17 8l-3 3.5" />
      <path d="M20 16H7" />
      <path d="M10 19.5 7 16l3-3.5" />
    </svg>
  );
}
