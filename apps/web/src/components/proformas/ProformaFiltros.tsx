"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Cliente, Proveedor } from "../../lib/types";
import { DateRangeDropdown, type DateSelection } from "../DateRangeDropdown";
import { ClienteSearchSelect } from "./ClienteSearchSelect";
import { ProveedorSearchSelect } from "./ProveedorSearchSelect";

export function ProformaFiltros({
  initialTipo,
  initialEstado,
  initialCreadoPorId,
  initialClienteId,
  initialProveedorId,
  initialFechaDesde,
  initialFechaHasta,
  vendedores,
  clientes,
  proveedores,
}: {
  initialTipo: string;
  initialEstado: string;
  initialCreadoPorId: string;
  initialClienteId: string;
  initialProveedorId: string;
  initialFechaDesde: string;
  initialFechaHasta: string;
  vendedores: { id: string; nombre: string }[];
  clientes: Cliente[];
  proveedores: Proveedor[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
        <label className="filter-label">Tipo</label>
        <select
          className="field"
          defaultValue={initialTipo}
          onChange={(e) => pushParams({ tipo: e.target.value, creadoPorId: "", clienteId: "", proveedorId: "" })}
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
