"use client";

import { useEffect, useState } from "react";

function partes(ms: number) {
  const total = Math.max(0, ms);
  return {
    d: Math.floor(total / 86_400_000),
    h: Math.floor((total % 86_400_000) / 3_600_000),
    m: Math.floor((total % 3_600_000) / 60_000),
    s: Math.floor((total % 60_000) / 1000),
  };
}

const dos = (n: number) => String(n).padStart(2, "0");

/**
 * Cuenta regresiva al fin de una campaña. «barra»: una línea compacta («14 d 14 h 22 m»); «bloque»: casilleros de días, horas, minutos
 * y segundos para la cabecera de la sección.
 */
export function CampanaCountdown({ fin, variante }: { fin: string; variante: "barra" | "bloque" }) {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const { d, h, m, s } = partes(new Date(fin).getTime() - ahora);

  if (variante === "barra") {
    return (
      <span className="campana-barra-tiempo" aria-label="Tiempo que falta para que termine">
        {d} d {dos(h)} h {dos(m)} m
      </span>
    );
  }

  const casilleros: [string, number, string][] = [
    ["DÍAS", d, ""],
    ["HORAS", h, ""],
    ["MIN", m, ""],
    ["SEG", s, " campana-caja--seg"],
  ];
  return (
    <div className="campana-cuenta" role="timer" aria-label="Tiempo que falta para que termine">
      {casilleros.map(([etiqueta, valor, extra]) => (
        <div key={etiqueta} className="campana-cuenta-item">
          <span className={`campana-caja${extra}`}>{dos(valor)}</span>
          <span className="campana-etiqueta">{etiqueta}</span>
        </div>
      ))}
    </div>
  );
}
