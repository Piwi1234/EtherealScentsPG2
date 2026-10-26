"use client";

import { useEffect, useState } from "react";
import { guardarUltimaLista } from "./VolverALista";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Ciudad, Cliente, Proveedor } from "../../lib/types";
import { DateRangeDropdown, type DateSelection } from "../DateRangeDropdown";
import { ClienteSearchSelect } from "./ClienteSearchSelect";
import { ProveedorSearchSelect } from "./ProveedorSearchSelect";

export function ProformaFiltros({
  initialTipo,
  initialEstado,
  initialEntrega,
  initialSinEnvio,
  initialCodigo,
  initialCreadoPorId,
  initialClienteId,
  initialProveedorId,
  initialCiudadEntregaId,
  initialFechaDesde,
  initialFechaHasta,
  vendedores,
  clientes,
  proveedores,
  ciudades,
}: {
  initialTipo: string;
  initialEstado: string;
  initialEntrega: string;
  initialSinEnvio: boolean;
  initialCodigo: string;
  initialCreadoPorId: string;
  initialClienteId: string;
  initialProveedorId: string;
  initialCiudadEntregaId: string;
  initialFechaDesde: string;
  initialFechaHasta: string;
  vendedores: { id: string; nombre: string }[];
  clientes: Cliente[];
  proveedores: Proveedor[];
  ciudades: Ciudad[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [codigoInput, setCodigoInput] = useState(initialCodigo);

  // Cada vez que cambian filtros o página se recuerda la URL, para que "Volver" desde una proforma
  // regrese a la lista tal como estaba.
  const queryActual = searchParams.toString();
  useEffect(() => {
    guardarUltimaLista(queryActual ? `${pathname}?${queryActual}` : pathname);
  }, [pathname, queryActual]);

  function pushParams(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleDateApply(selection: DateSelection) {
    pushParams({ fechaDesde: selection.fechaDesde ?? "", fechaHasta: selection.fechaHasta ?? "" });
  }

  // Búsqueda con debounce: espera a que el usuario deje de tipear antes de disparar el pedido.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (codigoInput.trim() !== initialCodigo) pushParams({ codigo: codigoInput.trim() });
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoInput]);

  const initialDateSelection =
    initialFechaDesde || initialFechaHasta
      ? {
          fechaDesde: initialFechaDesde || undefined,
          fechaHasta: initialFechaHasta || undefined,
          label: `${initialFechaDesde || "…"} → ${initialFechaHasta || "…"}`,
        }
      : undefined;

  return (
    <div className="filters-bar">
      <div className="filter-field">
        <label className="filter-label">Código</label>
        <input
          className="field"
          placeholder="Ej. 4HRNPZW"
          value={codigoInput}
          onChange={(e) => setCodigoInput(e.target.value)}
          style={{ width: 130 }}
        />
      </div>
      <div className="filter-field">
        <label className="filter-label">Tipo</label>
        <select
          className="field"
          defaultValue={initialTipo}
          onChange={(e) =>
            pushParams({
              tipo: e.target.value,
              creadoPorId: "",
              clienteId: "",
              proveedorId: "",
              ciudadEntregaId: "",
              entrega: "",
              sinEnvio: "",
            })
          }
        >
          <option value="">Elegí un tipo…</option>
          <option value="VENTA">Venta</option>
          <option value="COMPRA">Compra</option>
        </select>
      </div>
      <div className="filter-field">
        <label className="filter-label">Estado</label>
        <select className="field" defaultValue={initialEstado} onChange={(e) => pushParams({ estado: e.target.value })}>
          <option value="">Todos</option>
          <option value="BORRADOR">Borrador</option>
          <option value="APROBADA">Aprobada</option>
          <option value="COMPLETADA">Completada</option>
          <option value="ANULADA">Anulada</option>
        </select>
      </div>
      {initialTipo === "VENTA" && (
        <div className="filter-field">
          <label className="filter-label">Entrega</label>
          <select
            className="field"
            defaultValue={initialEntrega}
            // Estos estados solo existen en ventas aprobadas: al elegirlos se fija ese estado.
            onChange={(e) => pushParams({ entrega: e.target.value, estado: e.target.value ? "APROBADA" : initialEstado })}
          >
            <option value="">Todas</option>
            <option value="LISTA">Lista para completar</option>
            <option value="ESPERANDO">Esperando mercadería</option>
          </select>
        </div>
      )}
      {initialTipo === "COMPRA" && (
        <div className="filter-field">
          <label className="filter-label">Envío</label>
          <select className="field" defaultValue={initialSinEnvio ? "true" : ""} onChange={(e) => pushParams({ sinEnvio: e.target.value })}>
            <option value="">Todas</option>
            <option value="true">Sin envío</option>
          </select>
        </div>
      )}
      {initialTipo === "VENTA" && (
        <div className="filter-field">
          <label className="filter-label">Ciudad</label>
          <select
            className="field"
            defaultValue={initialCiudadEntregaId}
            onChange={(e) => pushParams({ ciudadEntregaId: e.target.value })}
          >
            <option value="">Todas</option>
            {ciudades.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      {initialTipo && <DateRangeDropdown onApply={handleDateApply} initialSelection={initialDateSelection} />}
      {initialTipo === "VENTA" && (
        <>
          <div className="filter-field">
            <label className="filter-label">Vendedor</label>
            <select
              className="field"
              defaultValue={initialCreadoPorId}
              onChange={(e) => pushParams({ creadoPorId: e.target.value })}
            >
              <option value="">Todos</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field" style={{ minWidth: 220 }}>
            <label className="filter-label">Cliente</label>
            <ClienteSearchSelect clientes={clientes} value={initialClienteId} onChange={(id) => pushParams({ clienteId: id })} />
          </div>
        </>
      )}
      {initialTipo === "COMPRA" && (
        <div className="filter-field" style={{ minWidth: 220 }}>
          <label className="filter-label">Proveedor</label>
          <ProveedorSearchSelect proveedores={proveedores} value={initialProveedorId} onChange={(id) => pushParams({ proveedorId: id })} />
        </div>
      )}
    </div>
  );
}
