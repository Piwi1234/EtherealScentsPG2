"use client";

import { useState } from "react";

// Paleta categórica del skill de dataviz (pasos "dark", validados contra superficie oscura) — se
// asigna en orden fijo, nunca ciclada a propósito ni reordenada según los datos.
export const SERIES_COLORS = [
  "#3987e5", // 1 blue
  "#d95926", // 2 orange
  "#199e70", // 3 aqua
  "#c98500", // 4 yellow
  "#d55181", // 5 magenta
  "#008300", // 6 green
  "#9085e9", // 7 violet
  "#e66767", // 8 red
];

const MUTED = "#898781";
const GRID = "#383835";
const INK = "#e9e9ed";

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}

export function StatTile({
  label,
  value,
  sublabel,
  color = SERIES_COLORS[0],
}: {
  label: string;
  value: string;
  sublabel?: string;
  color?: string;
}) {
  return (
    <div className="dash-stat-tile">
      <p className="dash-stat-label">{label}</p>
      <p className="dash-stat-value" style={{ color }}>
        {value}
      </p>
      {sublabel && <p className="dash-stat-sublabel">{sublabel}</p>}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length < 2) return null;
  return (
    <div className="dash-legend">
      {items.map((item) => (
        <span className="dash-legend-item" key={item.label}>
          <span className="dash-legend-swatch" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** Barras verticales agrupadas — 1+ series sobre las mismas categorías (ej. meses). */
export function BarChart({
  categories,
  series,
  height = 220,
  formatValue = formatCompact,
}: {
  categories: string[];
  series: { label: string; values: number[]; color?: string }[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const [hover, setHover] = useState<{ cat: number; s: number } | null>(null);
  const width = Math.max(360, categories.length * (series.length > 1 ? 46 : 30));
  const padTop = 16;
  const padBottom = 28;
  const padLeft = 8;
  const plotH = height - padTop - padBottom;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const groupW = (width - padLeft) / Math.max(1, categories.length);
  const barGap = 2;
  const barW = series.length > 1 ? (groupW - barGap * (series.length + 1)) / series.length : groupW - barGap * 2;

  if (categories.length === 0) {
    return <p className="dash-empty">Sin datos en el período elegido.</p>;
  }

  return (
    <div className="dash-chart-wrap">
      <Legend items={series.map((s, i) => ({ label: s.label, color: s.color ?? SERIES_COLORS[i] }))} />
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
        {/* Línea base */}
        <line x1={padLeft} y1={height - padBottom} x2={width} y2={height - padBottom} stroke={GRID} strokeWidth={1} />
        {categories.map((cat, ci) => {
          const groupX = padLeft + ci * groupW;
          return (
            <g key={cat}>
              {series.map((s, si) => {
                const value = s.values[ci] ?? 0;
                const barH = max > 0 ? (value / max) * plotH : 0;
                const x = groupX + barGap + si * (barW + barGap);
                const y = height - padBottom - barH;
                const color = s.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
                const isHover = hover?.cat === ci && hover.s === si;
                return (
                  <rect
                    key={s.label}
                    x={x}
                    y={y}
                    width={Math.max(1, barW)}
                    height={Math.max(0, barH)}
                    rx={3}
                    fill={color}
                    opacity={hover && !isHover ? 0.55 : 1}
                    onMouseEnter={() => setHover({ cat: ci, s: si })}
                    onMouseLeave={() => setHover(null)}
                  >
                    <title>
                      {cat} · {s.label}: {formatValue(value)}
                    </title>
                  </rect>
                );
              })}
              <text x={groupX + groupW / 2 - barGap} y={height - padBottom + 16} fontSize={10} fill={MUTED} textAnchor="middle">
                {cat}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && (
        <p className="dash-chart-hover">
          {categories[hover.cat]} · {series[hover.s].label}: {formatValue(series[hover.s].values[hover.cat] ?? 0)}
        </p>
      )}
    </div>
  );
}

/** Lista rankeada con barra horizontal — "top N" por categoría/cliente/proveedor. */
export function RankedBarList({
  items,
  formatValue = formatCompact,
  emptyLabel = "Sin datos en el período elegido.",
}: {
  items: { label: string; value: number; sublabel?: string }[];
  formatValue?: (v: number) => string;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="dash-empty">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="dash-ranked-list">
      {items.map((item, i) => (
        <div className="dash-ranked-row" key={`${item.label}-${item.sublabel ?? ""}`}>
          <div className="dash-ranked-label">
            <span>{item.label}</span>
            {item.sublabel && <span className="dash-ranked-sublabel">{item.sublabel}</span>}
          </div>
          <div className="dash-ranked-track">
            <div
              className="dash-ranked-fill"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: SERIES_COLORS[i % SERIES_COLORS.length] }}
            />
          </div>
          <span className="dash-ranked-value">{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export { formatCompact, INK, MUTED, GRID };
