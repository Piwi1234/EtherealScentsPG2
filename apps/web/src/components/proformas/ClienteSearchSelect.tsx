"use client";

import { useEffect, useRef, useState } from "react";
import type { Cliente } from "../../lib/types";

/**
 * Buscador de cliente con autocompletado: mismo patrón que ProductoSearchSelect.tsx — filtra una
 * lista ya cargada (clientes activos) a medida que se escribe, sin ida y vuelta al backend por cada
 * tecla. Elegir una sugerencia recién ahí aplica el filtro (clienteId).
 */
export function ClienteSearchSelect({
  clientes,
  value,
  onChange,
  disabled,
}: {
  clientes: Cliente[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = clientes.find((c) => c.id === value);
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
    ? clientes.filter((c) => {
        const q = query.trim().toLowerCase();
        return c.nombre.toLowerCase().includes(q) || c.numeroDocumento.toLowerCase().includes(q);
      })
    : clientes;

  function handleSelect(cliente: Cliente) {
    onChange(cliente.id);
    setQuery(cliente.nombre);
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
        placeholder="Buscar cliente…"
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
            matches.slice(0, 50).map((c) => (
              <button key={c.id} type="button" className="autocomplete-option" onClick={() => handleSelect(c)}>
                {c.nombre}
                <span className="cell-muted" style={{ marginLeft: 6, fontSize: 12 }}>
                  {c.numeroDocumento}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
