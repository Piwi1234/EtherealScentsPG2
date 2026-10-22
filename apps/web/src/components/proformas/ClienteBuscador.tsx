"use client";

import { useEffect, useRef, useState } from "react";
import { getClientes } from "../../lib/api";
import type { Cliente } from "../../lib/types";

const DEBOUNCE_MS = 300;
const RESULTS_LIMIT = 20;

/**
 * Buscador de cliente contra la base de datos: a diferencia de ClienteSearchSelect (que filtra una
 * lista ya cargada, y por eso solo ve los clientes más recientes), acá cada pausa al tipear consulta
 * `GET /clientes?search=` — nombre o email, entre TODOS los clientes activos. Devuelve el Cliente
 * completo (no solo el id) para que quien lo usa pueda tomar, por ejemplo, su ciudad.
 */
export function ClienteBuscador({
  value,
  initialNombre,
  onChange,
  disabled,
}: {
  value: string;
  initialNombre?: string;
  onChange: (cliente: Cliente | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(initialNombre ?? "");
  const [selectedNombre, setSelectedNombre] = useState(initialNombre ?? "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    // Con un cliente ya elegido, el texto del input es su nombre — abrir el panel no debería
    // filtrar por ese nombre completo, sino mostrar la lista general.
    const term = value && query === selectedNombre ? "" : query.trim();
    const timeout = setTimeout(() => {
      const current = ++requestId.current;
      setLoading(true);
      getClientes({ search: term || undefined, activo: "true", limit: RESULTS_LIMIT })
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
    onChange(cliente);
    setQuery(cliente.nombre);
    setSelectedNombre(cliente.nombre);
    setOpen(false);
  }

  function handleInputChange(text: string) {
    setQuery(text);
    setOpen(true);
    if (value) onChange(null);
  }

  return (
    <div className="date-dropdown" ref={ref}>
      <input
        className="field"
        placeholder="Buscar cliente por nombre o email…"
        value={query}
        disabled={disabled}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="autocomplete-panel">
          {error ? (
            <p className="error-text" style={{ margin: 0, padding: "8px 10px" }}>
              No se pudo buscar clientes.
            </p>
          ) : loading && results.length === 0 ? (
            <p className="cell-muted" style={{ margin: 0, padding: "8px 10px" }}>
              Buscando...
            </p>
          ) : results.length === 0 ? (
            <p className="cell-muted" style={{ margin: 0, padding: "8px 10px" }}>
              Sin coincidencias.
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
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
