"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Category, Empresa } from "../../lib/types";
import { ClienteBuscador } from "./ClienteBuscador";

type Vista = "pedidos" | "stock" | "solicitudes";

const ESTADOS_COMPLETOS: [string, string][] = [
  ["", "Todos"],
  ["SIN_COMPRA", "Sin compra"],
  ["EN_PREPARACION", "En preparación"],
  ["COMPRADO", "Comprado"],
  ["RECOGIDO", "Recogido"],
  ["EN_TRANSITO", "Enviado"],
];

// "Stock en compra" ya está comprado: arranca en Comprado.
const ESTADOS_STOCK: [string, string][] = [
  ["", "Todos"],
  ["COMPRADO", "Comprado"],
  ["RECOGIDO", "Recogido"],
  ["EN_TRANSITO", "Enviado"],
];

/**
 * Filtros de Seguimiento: estado como botones independientes, cliente (solo en pedidos de clientes), producto o marca
 * (texto), y categoría/empresa. Cada cambio se guarda en la URL (y vuelve a la página 1).
 */
export function SeguimientoFiltros({
  initialCategoryId,
  initialEstado,
  initialEmpresaId,
  initialClienteId,
  initialClienteNombre,
  initialSearch,
  vista,
  categories,
  empresas,
}: {
  initialCategoryId: string;
  initialEstado: string;
  initialEmpresaId: string;
  initialClienteId: string;
  initialClienteNombre: string;
  initialSearch: string;
  vista: Vista;
  categories: Category[];
  empresas: Empresa[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [clienteKey, setClienteKey] = useState(0);
  const primeraVez = useRef(true);

  function pushParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  // Búsqueda por producto o marca con debounce: espera a que se deje de tipear.
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    if (searchInput.trim() === initialSearch) return;
    const timeout = setTimeout(() => pushParams({ search: searchInput.trim() }), 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const estados = vista === "stock" ? ESTADOS_STOCK : ESTADOS_COMPLETOS;
  const hayFiltros = Boolean(initialEstado || initialCategoryId || initialEmpresaId || initialClienteId || initialSearch);

  return (
    <div className="filters-bar">
      <div className="filter-field">
        <label className="filter-label">Categoría</label>
        <select className="field" value={initialCategoryId} onChange={(e) => pushParams({ categoryId: e.target.value })}>
          <option value="">Todas</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-field">
        <label className="filter-label">Estado</label>
        <div className="seg" role="group" aria-label="Estado">
          {estados.map(([valor, etiqueta]) => (
            <button key={valor} type="button" className={initialEstado === valor ? "on" : undefined} onClick={() => pushParams({ estado: valor })}>
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      {vista === "pedidos" && (
        <div className="filter-field" style={{ minWidth: 220 }}>
          <label className="filter-label">Cliente</label>
          <ClienteBuscador
            key={clienteKey}
            value={initialClienteId}
            initialNombre={initialClienteNombre}
            onChange={(cliente) => pushParams({ clienteId: cliente?.id ?? "" })}
          />
        </div>
      )}

      <div className="filter-field" style={{ minWidth: 220, flex: 1 }}>
        <label className="filter-label">Producto o marca</label>
        <input className="field" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Nombre, código o marca" />
      </div>

      <div className="filter-field">
        <label className="filter-label">Empresa</label>
        <select className="field" value={initialEmpresaId} onChange={(e) => pushParams({ empresaId: e.target.value })}>
          <option value="">Todas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </div>

      {hayFiltros && (
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setSearchInput("");
              setClienteKey((k) => k + 1);
              const params = new URLSearchParams();
              params.set("vista", vista);
              router.push(`${pathname}?${params.toString()}`);
            }}
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
