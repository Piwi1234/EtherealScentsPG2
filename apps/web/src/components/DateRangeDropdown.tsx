"use client";

import { useEffect, useRef, useState } from "react";

type DateMode = "rango" | "mes" | "anio";

export type DateSelection = { fechaDesde?: string; fechaHasta?: string; label: string };

const TODO_EL_TIEMPO: DateSelection = { label: "Todo el tiempo" };

function ultimoDiaDelMes(anioMes: string): string {
  const [y, m] = anioMes.split("-").map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return `${anioMes}-${String(ultimo).padStart(2, "0")}`;
}

function labelMes(anioMes: string): string {
  const [y, m] = anioMes.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-VE", { year: "numeric", month: "long" });
}

/**
 * Filtro de fecha desplegable con 3 modos (rango / mes / año) — arma fechaDesde/fechaHasta en el
 * cliente y se los pasa al padre ya resueltos; el backend solo entiende un rango simple. Sin
 * librería de calendario: son inputs nativos date/month + un select de año. Compartido entre
 * Registros y Contabilidad (no es específico de proformas).
 */
export function DateRangeDropdown({ onApply }: { onApply: (selection: DateSelection) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DateMode>("rango");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [mes, setMes] = useState("");
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [activeLabel, setActiveLabel] = useState(TODO_EL_TIEMPO.label);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function commit(selection: DateSelection) {
    setActiveLabel(selection.label);
    onApply(selection);
    setOpen(false);
  }

  function handleApply() {
    if (mode === "rango") {
      if (!desde && !hasta) return commit(TODO_EL_TIEMPO);
      const label = `${desde || "…"} → ${hasta || "…"}`;
      commit({ fechaDesde: desde || undefined, fechaHasta: hasta || undefined, label });
    } else if (mode === "mes") {
      if (!mes) return;
      commit({ fechaDesde: `${mes}-01`, fechaHasta: ultimoDiaDelMes(mes), label: labelMes(mes) });
    } else {
      if (!anio) return;
      commit({ fechaDesde: `${anio}-01-01`, fechaHasta: `${anio}-12-31`, label: anio });
    }
  }

  function handleClear() {
    setDesde("");
    setHasta("");
    setMes("");
    commit(TODO_EL_TIEMPO);
  }

  return (
    <div className="date-dropdown" ref={ref}>
      <label className="filter-label">Fecha</label>
      <button type="button" className="field date-dropdown-trigger" onClick={() => setOpen((o) => !o)}>
        {activeLabel}
      </button>
      {open && (
        <div className="date-dropdown-panel">
          <div className="date-dropdown-modes">
            <button
              type="button"
              className={`date-dropdown-mode-btn${mode === "rango" ? " active" : ""}`}
              onClick={() => setMode("rango")}
            >
              Rango
            </button>
            <button
              type="button"
              className={`date-dropdown-mode-btn${mode === "mes" ? " active" : ""}`}
              onClick={() => setMode("mes")}
            >
              Mes
            </button>
            <button
              type="button"
              className={`date-dropdown-mode-btn${mode === "anio" ? " active" : ""}`}
              onClick={() => setMode("anio")}
            >
              Año
            </button>
          </div>

          {mode === "rango" && (
            <>
              <div>
                <label className="filter-label">Desde</label>
                <input className="field" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div>
                <label className="filter-label">Hasta</label>
                <input className="field" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </div>
            </>
          )}

          {mode === "mes" && (
            <div>
              <label className="filter-label">Mes</label>
              <input className="field" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            </div>
          )}

          {mode === "anio" && (
            <div>
              <label className="filter-label">Año</label>
              <input
                className="field"
                type="number"
                min="2000"
                max="2100"
                step="1"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
            <button type="button" className="link-button" onClick={handleClear}>
              Limpiar
            </button>
            <button type="button" className="action-btn" onClick={handleApply}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
