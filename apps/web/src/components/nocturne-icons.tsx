// Filled icons for the "Nocturne" sidebar theme (Dashboard/Categorías/Marcas/Productos nav, the
// Clientes/Proveedores/Stock/Contabilidad/Configuración accordion toggles, and Logout) — ported
// from the "Panel Nocturne" mockup built in Claude Design. Distinct from icons.tsx (the app's
// original outline set, still used for every page outside the Nocturne scope).

type IconProps = { className?: string };

export function DashboardIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M104,40H56A16,16,0,0,0,40,56v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,104,40Zm0,64H56V56h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,64H152V56h48v48Zm-96,32H56a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,64H56V152h48v48Zm96-64H152a16,16,0,0,0-16,16v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V152A16,16,0,0,0,200,136Zm0,64H152V152h48v48Z" />
    </svg>
  );
}

export function CategoriesIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M216,72H130.67L102.94,51.2a16,16,0,0,0-9.6-3.2H40A16,16,0,0,0,24,64V192.13A15.89,15.89,0,0,0,39.87,208H216.13A15.89,15.89,0,0,0,232,192.13V88A16,16,0,0,0,216,72ZM40,64H93.33l21.34,16H40ZM216,192H40V96H216Z" />
    </svg>
  );
}

export function BrandsIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M184,32H72A16,16,0,0,0,56,48V224a8,8,0,0,0,12.24,6.78L128,193.43l59.76,37.35A8,8,0,0,0,200,224V48A16,16,0,0,0,184,32Zm0,177.57-51.76-32.35a8,8,0,0,0-8.48,0L72,209.57V48H184Z" />
    </svg>
  );
}

export function ProductsIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.34,44-29.77,16.3-80.35-44Zm0,88L47.66,76,78.15,59.34l80.35,44ZM40,90l80,43.78v85.79L40,175.82Zm96,129.57V133.82l80-43.79v85.79Z" />
    </svg>
  );
}

/** Used for both the Clientes and Proveedores accordion toggles — the mockup reuses this one icon for both. */
export function ClientsIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M117.25,157.92a60,60,0,1,0-66.5,0A95.83,95.83,0,0,0,3.53,195.63a8,8,0,1,0,13.4,8.74,80,80,0,0,1,134.14,0,8,8,0,0,0,13.4-8.74A95.83,95.83,0,0,0,117.25,157.92ZM40,108a44,44,0,1,1,44,44A44.05,44.05,0,0,1,40,108Zm210.14,98.7a8,8,0,0,1-11.07-2.33A79.83,79.83,0,0,0,172,168a8,8,0,0,1,0-16,44,44,0,1,0-16.34-84.87,8,8,0,1,1-5.94-14.85,60,60,0,0,1,55.53,105.64,95.83,95.83,0,0,1,47.22,37.71A8,8,0,0,1,250.14,206.7Z" />
    </svg>
  );
}

export function StockIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,120,47.66,76,128,32l80.34,44Z" />
    </svg>
  );
}

/** Used for the Proformas, Registros, and Seguimiento nav items — the mockup reuses this one icon for all three. */
export function ProformasIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M213.66,66.34l-40-40A8,8,0,0,0,168,24H88A16,16,0,0,0,72,40V64H48A16,16,0,0,0,32,80V216a16,16,0,0,0,16,16H168a16,16,0,0,0,16-16V192h24a16,16,0,0,0,16-16V72A8,8,0,0,0,213.66,66.34ZM168,216H48V80H136v88a16,16,0,0,0,16,16h16Zm40-40H152V80a8,8,0,0,0-2.34-5.66l-40-40H168V72a8,8,0,0,0,8,8h32Z" />
    </svg>
  );
}

export function ContabilidadIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M224,48H32A16,16,0,0,0,16,64V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V64A16,16,0,0,0,224,48ZM32,64H224V88H32ZM32,192V104H224v88Zm144-32a8,8,0,0,1-8,8H152a8,8,0,0,1,0-16h16A8,8,0,0,1,176,160Z" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M128,80a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Zm88-29.84q.06-2.16,0-4.32l14.92-18.64a8,8,0,0,0,1.48-7.06,107.6,107.6,0,0,0-10.88-26.25,8,8,0,0,0-6-4L195,66.69q-1.48-1.56-3-3L189.87,44a8,8,0,0,0-4-6,107.6,107.6,0,0,0-26.25-10.88,8,8,0,0,0-7.06,1.48L134,44.32Q131.8,44.26,129.63,44.32L111,29.4a8,8,0,0,0-7.06-1.48A107.6,107.6,0,0,0,77.69,38.8a8,8,0,0,0-4,6L69.4,64.85q-1.56,1.48-3,3L44,70.15a8,8,0,0,0-6,4A107.6,107.6,0,0,0,27.12,100.4a8,8,0,0,0,1.48,7.06L43.52,126.1q-.06,2.16,0,4.32L28.6,149.06a8,8,0,0,0-1.48,7.06,107.6,107.6,0,0,0,10.88,26.25,8,8,0,0,0,6,4L61,189.31q1.48,1.56,3,3L67.13,212a8,8,0,0,0,4,6,107.6,107.6,0,0,0,26.25,10.88,8,8,0,0,0,7.06-1.48L122,211.68q2.16.06,4.32,0L145,226.6a8,8,0,0,0,7.06,1.48,107.6,107.6,0,0,0,26.25-10.88,8,8,0,0,0,4-6l4.85-18.44q1.56-1.48,3-3l18.44,4.85a8,8,0,0,0,7.06-1.48,107.6,107.6,0,0,0,10.88-26.25,8,8,0,0,0-1.48-7.06Z" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M112,216a8,8,0,0,1-8,8H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h56a8,8,0,0,1,0,16H48V208h56A8,8,0,0,1,112,216Zm109.66-93.66-40-40a8,8,0,0,0-11.32,11.32L196.69,120H104a8,8,0,0,0,0,16h92.69l-26.35,26.34a8,8,0,0,0,11.32,11.32l40-40A8,8,0,0,0,221.66,122.34Z" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
