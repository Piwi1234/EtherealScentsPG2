"use client";

import { useEffect, useState } from "react";

const URGENT_THRESHOLD_MS = 3 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

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
 * renderiza nada) apenas se vence, sin esperar a que la página se recargue contra el backend.
 *
 * "pill": una línea "Termina en 2h 14m" (uso general, ProductCard fuera del carrusel de ofertas).
 * "boxes": 3 casilleros HH/MM/SS (carrusel de "Descuento y Ofertas" del home) — celeste si faltan
 * más de 3 horas, rosado oscuro si faltan menos (ver URGENT_THRESHOLD_MS). */
export function FlashCountdown({
  until,
  className = "",
  variant = "pill",
}: {
  until: string;
  className?: string;
  variant?: "pill" | "boxes";
}) {
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

  if (variant === "boxes") {
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const urgent = remaining < URGENT_THRESHOLD_MS;
    return (
      <div
        className={`landing-flash-boxes${urgent ? " landing-flash-boxes--urgent" : ""}${className ? ` ${className}` : ""}`}
      >
        <span className="landing-flash-box">
          <span className="landing-flash-box-value">{pad(hours)}</span>
          <span className="landing-flash-box-label">H</span>
        </span>
        <span className="landing-flash-box">
          <span className="landing-flash-box-value">{pad(minutes)}</span>
          <span className="landing-flash-box-label">M</span>
        </span>
        <span className="landing-flash-box">
          <span className="landing-flash-box-value">{pad(seconds)}</span>
          <span className="landing-flash-box-label">S</span>
        </span>
      </div>
    );
  }

  return (
    <span className={`landing-flash-countdown${className ? ` ${className}` : ""}`}>
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2 3 14h6.5l-1.5 8L21 10h-6.5L13 2Z" />
      </svg>
      Termina en {formatRemaining(remaining)}
    </span>
  );
}
