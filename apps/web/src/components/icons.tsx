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
