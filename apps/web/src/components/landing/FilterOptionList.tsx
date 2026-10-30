"use client";

import { useMemo, useState } from "react";
import { contieneBusqueda } from "../../lib/busqueda";

// Compartido entre CategoriaClient (Subcategoría/Marca/Atributos) y BuscarClient (Marca) — antes
// vivía solo en CategoriaClient; al necesitarse también en /buscar para el filtro de Marca, se
// extrajo acá en vez de duplicar la lista de checkboxes + buscador + "Mostrar más/menos".

const FILTER_VISIBLE_DEFAULT = 10;

export type FilterOption = { value: string; label: string; count?: number; color?: string | null };

/**
 * Lista de checkboxes ordenada alfabéticamente por `label`; si hay más de FILTER_VISIBLE_DEFAULT
 * opciones, suma un buscador interno. Dos formas de ver el resto:
 * - "expand" (Subcategoría, Marca en categoría): 10 visibles por defecto + "Mostrar más/menos".
 * - "scroll" (Atributos, Marca en búsqueda): todas las opciones de una, dentro de una caja con
 *   scroll propio — no empuja el resto del sidebar hacia abajo.
 */
export function FilterOptionList({
  title,
  options,
  selected,
  onToggle,
  variant = "expand",
  maxSelected,
}: {
  title: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  variant?: "expand" | "scroll";
  /** Ej. Acordes: no deja tildar una opción nueva una vez alcanzado el tope (las ya tildadas se
   * pueden seguir destildando). */
  maxSelected?: number;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => [...options].sort((a, b) => a.label.localeCompare(b.label)), [options]);
  const term = search.trim();
  const filtered = term ? sorted.filter((o) => contieneBusqueda(o.label, term)) : sorted;
  const needsSearch = sorted.length > FILTER_VISIBLE_DEFAULT;
  const visible =
    variant === "scroll" ? filtered : term || showAll ? filtered : filtered.slice(0, FILTER_VISIBLE_DEFAULT);
  const limitReached = maxSelected !== undefined && selected.length >= maxSelected;

  const list = (
    <>
      {visible.map((option) => {
        const isSelected = selected.includes(option.value);
        const disabled = limitReached && !isSelected;
        return (
          <label
            className={`landing-filter-checkbox${disabled ? " landing-filter-checkbox--disabled" : ""}`}
            key={option.value}
          >
            <input type="checkbox" checked={isSelected} disabled={disabled} onChange={() => onToggle(option.value)} />
            {option.color && <span className="landing-filter-swatch" style={{ background: option.color }} />}
            <span className="landing-filter-checkbox-label">{option.label}</span>
            {option.count !== undefined && <span className="landing-filter-count">{option.count}</span>}
          </label>
        );
      })}
      {visible.length === 0 && (
        <p className="landing-empty-note" style={{ margin: 0, fontSize: 12.5 }}>
          Sin resultados.
        </p>
      )}
    </>
  );

  return (
    <div className="landing-filter-group">
      <p className="landing-filter-group-title">{title}</p>
      {needsSearch && (
        <input
          type="search"
          className="landing-filter-search"
          placeholder={`Buscar ${title.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {variant === "scroll" && needsSearch ? <div className="landing-filter-options-scroll">{list}</div> : list}
      {variant === "expand" && !term && filtered.length > FILTER_VISIBLE_DEFAULT && (
        <button type="button" className="landing-filter-clear" style={{ marginTop: 6 }} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Mostrar menos" : `Mostrar más (${filtered.length - FILTER_VISIBLE_DEFAULT})`}
        </button>
      )}
      {maxSelected !== undefined && (
        <p className="landing-empty-note" style={{ margin: "6px 0 0", fontSize: 12 }}>
          {limitReached ? `Máximo ${maxSelected} seleccionados.` : `Hasta ${maxSelected} a la vez.`}
        </p>
      )}
    </div>
  );
}
