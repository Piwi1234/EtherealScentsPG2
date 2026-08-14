"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "../../lib/types";

/**
 * Buscador de producto con autocompletado: filtra la lista ya cargada (scoped por categoría/marca
 * en el padre) a medida que se escribe, sin ida y vuelta al backend por cada tecla. Elegir una
 * sugerencia recién ahí aplica el filtro (productId) — mientras se escribe sin elegir nada, no
 * cambia el filtro real, solo acota las sugerencias.
 */
export function ProductoSearchSelect({
  products,
  value,
  onChange,
  disabled,
}: {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = products.find((p) => p.id === value);
    setQuery(selected ? selected.name : "");
    // Solo cuando cambia el id elegido desde afuera (ej. se resetea al cambiar categoría) —
    // no cada vez que cambia `products`, para no pisar lo que el usuario está escribiendo.
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
    ? products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : products;

  function handleSelect(product: Product) {
    onChange(product.id);
    setQuery(product.name);
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
        placeholder="Buscar producto…"
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
                {p.name}
                <span className="cell-muted" style={{ marginLeft: 6, fontSize: 12 }}>
                  {p.productCode}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
