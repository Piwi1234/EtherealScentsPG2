"use client";

import { useEffect, useRef, useState } from "react";
import type { Proveedor } from "../../lib/types";

/**
 * Buscador de proveedor con autocompletado: mismo patrón que ClienteSearchSelect.tsx — filtra una
 * lista ya cargada (proveedores activos) a medida que se escribe, sin ida y vuelta al backend por
 * cada tecla. Elegir una sugerencia recién ahí aplica el filtro (proveedorId).
 */
export function ProveedorSearchSelect({
  proveedores,
  value,
  onChange,
  disabled,
}: {
  proveedores: Proveedor[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = proveedores.find((p) => p.id === value);
    setQuery(selected ? selected.nombre : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const matches = query.trim()
    ? proveedores.filter((p) => p.nombre.toLowerCase().includes(query.trim().toLowerCase()))
    : proveedores;

  function handleSelect(proveedor: Proveedor) {
    onChange(proveedor.id);
    setQuery(proveedor.nombre);
    setOpen(false);
  }

  function handleInputChange(text: string) {
    setQuery(text);
    setOpen(true);
    if (value) onChange("");
  }

  return (
    <div className="date-dropdown" ref={ref}>
      <input
        className="field"
        placeholder="Buscar proveedor…"
        value={query}
        disabled={disabled}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="autocomplete-panel">
          {matches.length === 0 ? (
            <p className="cell-muted" style={{ margin: 0, padding: "8px 10px" }}>
              Sin coincidencias.
            </p>
          ) : (
            matches.slice(0, 50).map((p) => (
              <button key={p.id} type="button" className="autocomplete-option" onClick={() => handleSelect(p)}>
                {p.nombre}
                {p.paisProcedencia && (
                  <span className="cell-muted" style={{ marginLeft: 6, fontSize: 12 }}>
                    {p.paisProcedencia.nombre}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
