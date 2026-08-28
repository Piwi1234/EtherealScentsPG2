"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Cuenta regresiva de una Oferta Flash — se actualiza sola cada segundo. Devuelve null (no
 * renderiza nada) apenas se vence, sin esperar a que la página se recargue contra el backend. */
export function FlashCountdown({ until, className = "" }: { until: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // now === null en el primer render del servidor (evita mismatch de hidratación con Date.now()).
  if (now === null) return null;

  const remaining = new Date(until).getTime() - now;
  if (remaining <= 0) return null;

  return (
    <span className={`landing-flash-countdown${className ? ` ${className}` : ""}`}>
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2 3 14h6.5l-1.5 8L21 10h-6.5L13 2Z" />
      </svg>
      Termina en {formatRemaining(remaining)}
    </span>
  );
}
