"use client";

import { SelectorMes } from "./SelectorMes";

type Item = { cliente: string; total: number };

function bs(value: number): string {
  return `Bs ${value.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Ranking de clientes del mes: puesto, nombre, barra proporcional al líder, monto y el peso de
 * cada uno dentro del top. El mes se cambia con flechas (ver SelectorMes); no se puede avanzar más allá del mes en curso.
 */
export function TopClientes({
  items,
  month,
  maxMonth,
  onMonthChange,
  className = "",
}: {
  className?: string;
  items: Item[] | null;
  month: string;
  maxMonth: string;
  onMonthChange: (month: string) => void;
}) {
  const max = Math.max(1, ...(items ?? []).map((i) => i.total));
  const suma = (items ?? []).reduce((n, i) => n + i.total, 0);

  return (
    <div className={`card topc ${className}`}>
      <div className="topc-head">
        <div style={{ minWidth: 0 }}>
          <p className="dash-widget-title">Top 10 clientes</p>
          <p className="dash-widget-note">Total comprado en el mes elegido.</p>
        </div>
        <SelectorMes month={month} maxMonth={maxMonth} onMonthChange={onMonthChange} />
      </div>

      {items === null ? (
        <p className="dash-empty">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="dash-empty">Sin compras en este mes.</p>
      ) : (
        <>
          <div className="topc-total">
            <span>Suma del top</span>
            <strong>{bs(suma)}</strong>
          </div>
          <ol className="topc-list">
            {items.map((c, i) => (
              <li key={`${c.cliente}-${i}`} className={`topc-row${i === 0 ? " topc-row--first" : ""}`}>
                <span className={`topc-rank${i < 3 ? " topc-rank--top" : ""}`}>{i + 1}</span>
                <div className="topc-main">
                  <span className="topc-name" title={c.cliente}>
                    {c.cliente}
                  </span>
                  <div className="topc-track">
                    <div className="topc-fill" style={{ width: `${Math.max(3, (c.total / max) * 100)}%` }} />
                  </div>
                </div>
                <div className="topc-amount">
                  <strong>{bs(c.total)}</strong>
                  <small>{suma > 0 ? `${Math.round((c.total / suma) * 100)}%` : "—"}</small>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
