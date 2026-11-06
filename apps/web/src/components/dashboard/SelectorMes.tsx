"use client";

import { ChevronDownIcon } from "../nocturne-icons";

/** "2026-10" → primer día de ese mes, a mediodía (evita saltos de día por la zona horaria). */
function fechaDeMes(month: string): Date {
  const [anio, mes] = month.split("-").map(Number);
  return new Date(anio, (mes || 1) - 1, 1, 12);
}

export function moverMes(month: string, delta: number): string {
  const d = fechaDeMes(month);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-10" → "Octubre de 2026". */
export function etiquetaMes(month: string): string {
  const texto = fechaDeMes(month).toLocaleDateString("es-BO", { month: "long", year: "numeric" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Selector de mes con flechas (en vez del selector nativo, que se cortaba y variaba según el navegador); no se puede avanzar más
 * allá de `maxMonth`. Lo usan los bloques del dashboard que se miran de a un mes (Top 10 clientes, Ventas por categoría).
 */
export function SelectorMes({ month, maxMonth, onMonthChange }: { month: string; maxMonth: string; onMonthChange: (month: string) => void }) {
  return (
    <div className="topc-month" role="group" aria-label="Mes">
      <button type="button" aria-label="Mes anterior" onClick={() => onMonthChange(moverMes(month, -1))}>
        <ChevronDownIcon className="topc-arrow topc-arrow--prev" />
      </button>
      <span>{etiquetaMes(month)}</span>
      <button type="button" aria-label="Mes siguiente" disabled={month >= maxMonth} onClick={() => onMonthChange(moverMes(month, 1))}>
        <ChevronDownIcon className="topc-arrow topc-arrow--next" />
      </button>
    </div>
  );
}
