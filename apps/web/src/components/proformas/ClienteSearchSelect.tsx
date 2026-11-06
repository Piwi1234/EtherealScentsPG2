"use client";

import { useEffect, useRef, useState } from "react";
import { getClientes } from "../../lib/api";
import type { Cliente } from "../../lib/types";

const DEBOUNCE_MS = 300;
const RESULTS_LIMIT = 20;

/**
 * Buscador de cliente para filtros: cada pausa al tipear consulta `GET /clientes?search=` (nombre o email, sin
 * acentos) entre TODOS los clientes, activos o no — una cuenta o un pedido puede ser de un cliente ya desactivado.
 * Antes filtraba una lista cargada de una sola vez, y como la API devuelve como máximo 100 por pedido solo veía los
 * clientes más recientes: uno más antiguo "no existía". Elegir una sugerencia recién ahí aplica el filtro (clienteId).
 */
export function ClienteSearchSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [selectedNombre, setSelectedNombre] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  // Si el filtro se limpia desde afuera, el texto también.
  useEffect(() => {
    if (!value) {
      setSelectedNombre("");
      setQuery((q) => (q === selectedNombre ? "" : q));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Con un cliente ya elegido, el input muestra su nombre: abrir el panel no filtra por ese nombre, muestra la lista general.
    const term = value && query === selectedNombre ? "" : query.trim();
    const timeout = setTimeout(() => {
      const current = ++requestId.current;
      setLoading(true);
      getClientes({ search: term || undefined, limit: RESULTS_LIMIT })
        .then((page) => {
          if (current !== requestId.current) return;
          setResults(page.items);
          setError(false);
        })
        .catch(() => {
          if (current === requestId.current) setError(true);
        })
        .finally(() => {
          if (current === requestId.current) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query, open, value, selectedNombre]);

  function handleSelect(cliente: Cliente) {
    onChange(cliente.id);
    setQuery(cliente.nombre);
    setSelectedNombre(cliente.nombre);
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
          {error ? (
            <p className="error-text" style={{ margin: 0, padding: "8px 10px" }}>
              No se pudo buscar. Intenta de nuevo.
            </p>
          ) : results.length === 0 ? (
            <p className="cell-muted" style={{ margin: 0, padding: "8px 10px" }}>
              {loading ? "Buscando…" : "Sin coincidencias."}
            </p>
          ) : (
            results.map((c) => (
              <button key={c.id} type="button" className="autocomplete-option" onClick={() => handleSelect(c)}>
                {c.nombre}
                {c.email && (
                  <span className="cell-muted" style={{ marginLeft: 6, fontSize: 12 }}>
                    {c.email}
                  </span>
                )}
                {!c.activo && (
                  <span className="cell-muted" style={{ marginLeft: 6, fontSize: 12 }}>
                    (inactivo)
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
