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

/** Fila de cifras resumen sobre un gráfico (total, promedio, mejor mes...). */
export function MiniStats({ items }: { items: { label: string; value: string; note?: string; tone?: "pos" | "neg" }[] }) {
  return (
    <div className="dash-mini-stats">
      {items.map((i) => (
        <div className="dash-mini-stat" key={i.label}>
          <span className="dash-mini-stat-label">{i.label}</span>
          <strong className="dash-mini-stat-value">{i.value}</strong>
          {i.note && <span className={`dash-mini-stat-note${i.tone ? ` ${i.tone}` : ""}`}>{i.note}</span>}
        </div>
      ))}
    </div>
  );
}

/** Una barra horizontal partida en partes (ej. stock disponible vs reservado) con su leyenda y porcentaje. */
export function SplitBar({ parts, formatValue = formatCompact }: { parts: { label: string; value: number; color: string }[]; formatValue?: (v: number) => string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div>
      <div className="dash-split-bar">
        {total > 0 ? (
          parts.map((p) => <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${formatValue(p.value)}`} />)
        ) : (
          <div style={{ width: "100%" }} />
        )}
      </div>
      <div className="dash-split-legend">
        {parts.map((p) => (
          <div key={p.label} className="dash-split-item">
            <span className="dash-legend-swatch" style={{ background: p.color }} />
            <span className="dash-split-name">{p.label}</span>
            <strong>{formatValue(p.value)}</strong>
            <small>{total > 0 ? `${Math.round((p.value / total) * 100)}%` : "—"}</small>
          </div>
        ))}
      </div>
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

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2025-09" -> "sep 25" — bastante más corto que la fecha ISO, para que entre sin superponerse con
 * el mes de al lado. Cualquier categoría que no tenga esa forma (nombres, no fechas) se deja igual. */
function defaultFormatCategory(cat: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(cat);
  if (!match) return cat;
  const mes = MESES_CORTOS[Number(match[2]) - 1] ?? match[2];
  return `${mes} ${match[1].slice(2)}`;
}

/** Máximo "redondo" para el eje (1, 2, 2.5, 5 × 10^n) y 4 divisiones. */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  const top = nice * exp;
  return { top, ticks: [0, top / 4, top / 2, (top * 3) / 4, top] };
}

/** Barras verticales agrupadas — 1+ series sobre las mismas categorías (ej. meses). Eje con guías,
 * etiquetas horizontales, valor sobre cada barra (una sola serie) y el último período resaltado. */
export function BarChart({
  categories,
  series,
  height = 250,
  formatValue = formatCompact,
  formatCategory = defaultFormatCategory,
  highlightLast = false,
}: {
  categories: string[];
  series: { label: string; values: number[]; color?: string }[];
  height?: number;
  formatValue?: (v: number) => string;
  formatCategory?: (cat: string) => string;
  /** Resalta el último período (el mes en curso) y atenúa los demás. */
  highlightLast?: boolean;
}) {
  const [hover, setHover] = useState<{ cat: number; s: number } | null>(null);

  if (categories.length === 0) {
    return <p className="dash-empty">Sin datos en el período elegido.</p>;
  }

  const width = 720;
  const padTop = 22;
  const padBottom = 26;
  const padLeft = 46;
  const padRight = 8;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const { top, ticks } = niceScale(Math.max(0, ...series.flatMap((s) => s.values)));
  const groupW = plotW / categories.length;
  const barGap = 3;
  const barW = Math.max(2, Math.min(series.length > 1 ? 26 : 46, (groupW * 0.72 - barGap * (series.length - 1)) / series.length));
  const clusterW = barW * series.length + barGap * (series.length - 1);
  const labelStep = Math.ceil(categories.length / 12);
  const showValues = series.length === 1 && categories.length <= 14;
  const last = categories.length - 1;

  return (
    <div className="dash-chart-wrap">
      <Legend items={series.map((s, i) => ({ label: s.label, color: s.color ?? SERIES_COLORS[i] }))} />
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" style={{ minWidth: Math.min(width, Math.max(420, categories.length * 36)) }}>
        {ticks.map((t) => {
          const y = padTop + plotH - (t / top) * plotH;
          return (
            <g key={t}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke={GRID} strokeWidth={1} strokeDasharray={t === 0 ? undefined : "3 4"} />
              <text x={padLeft - 6} y={y + 3} fontSize={10} fill={MUTED} textAnchor="end">
                {formatCompact(t)}
              </text>
            </g>
          );
        })}
        {categories.map((cat, ci) => {
          const cx = padLeft + ci * groupW + groupW / 2;
          const x0 = cx - clusterW / 2;
          return (
            <g key={cat}>
              {series.map((s, si) => {
                const value = s.values[ci] ?? 0;
                const barH = (value / top) * plotH;
                const x = x0 + si * (barW + barGap);
                const y = padTop + plotH - barH;
                const color = s.color ?? SERIES_COLORS[si % SERIES_COLORS.length];
                const isHover = hover?.cat === ci && hover.s === si;
                const dim = (hover && !isHover) || (!hover && highlightLast && ci !== last);
                return (
                  <g key={s.label}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(0, barH)}
                      rx={3}
                      fill={color}
                      opacity={dim ? 0.5 : 1}
                      onMouseEnter={() => setHover({ cat: ci, s: si })}
                      onMouseLeave={() => setHover(null)}
                    >
                      <title>
                        {formatCategory(cat)} · {s.label}: {formatValue(value)}
                      </title>
                    </rect>
                    {showValues && value > 0 && (
                      <text x={x + barW / 2} y={y - 5} fontSize={10} fill={INK} textAnchor="middle" fontWeight={600}>
                        {formatCompact(value)}
                      </text>
                    )}
                  </g>
                );
              })}
              {ci % labelStep === 0 && (
                <text x={cx} y={height - 8} fontSize={10.5} fill={ci === last && highlightLast ? INK : MUTED} textAnchor="middle" fontWeight={ci === last && highlightLast ? 600 : 400}>
                  {formatCategory(cat)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover && (
        <p className="dash-chart-hover">
          {formatCategory(categories[hover.cat])} · {series[hover.s].label}: {formatValue(series[hover.s].values[hover.cat] ?? 0)}
        </p>
      )}
    </div>
  );
}

/** Lista rankeada con barra horizontal — "top N" por categoría/cliente/proveedor. Muestra el peso de cada
 * uno sobre el total y, si hay más de `maxItems`, deja el resto detrás de "Ver todos". */
export function RankedBarList({
  items,
  formatValue = formatCompact,
  emptyLabel = "Sin datos en el período elegido.",
  maxItems = 8,
  showShare = true,
}: {
  items: { label: string; value: number; sublabel?: string }[];
  formatValue?: (v: number) => string;
  emptyLabel?: string;
  maxItems?: number;
  showShare?: boolean;
}) {
  const [todos, setTodos] = useState(false);
  if (items.length === 0) {
    return <p className="dash-empty">{emptyLabel}</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((n, i) => n + i.value, 0);
  const visibles = todos ? items : items.slice(0, maxItems);
  return (
    <div className="dash-ranked-list">
      {visibles.map((item, i) => (
        <div className="dash-ranked-row" key={`${item.label}-${item.sublabel ?? ""}`}>
          <div className="dash-ranked-label" title={item.sublabel ? `${item.label} · ${item.sublabel}` : item.label}>
            <span>{item.label}</span>
            {item.sublabel && <span className="dash-ranked-sublabel">{item.sublabel}</span>}
          </div>
          <div className="dash-ranked-track">
            <div className="dash-ranked-fill" style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
          </div>
          <span className="dash-ranked-value">
            {formatValue(item.value)}
            {showShare && total > 0 && <small>{Math.round((item.value / total) * 100)}%</small>}
          </span>
        </div>
      ))}
      {items.length > maxItems && (
        <button type="button" className="link-button dash-ranked-more" onClick={() => setTodos((v) => !v)}>
          {todos ? "Ver menos" : `Ver todos (${items.length})`}
        </button>
      )}
    </div>
  );
}

export { formatCompact, INK, MUTED, GRID };
