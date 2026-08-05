"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Empresa } from "../../lib/types";

export function SeguimientoFiltros({
  initialEstado,
  initialTipo,
  initialEmpresaId,
  empresas,
}: {
  initialEstado: string;
  initialTipo: string;
  initialEmpresaId: string;
  empresas: Empresa[];
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

  return (
    <div className="filters-bar">
      <div className="filter-field">
        <label className="filter-label">Estado</label>
        <select className="field" defaultValue={initialEstado} onChange={(e) => pushParams({ estado: e.target.value })}>
          <option value="">Todos</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="COMPRADO">Comprado</option>
          <option value="ENVIADO">Enviado</option>
          <option value="RECIBIDO">Recibido</option>
        </select>
      </div>
      <div className="filter-field">
        <label className="filter-label">Tipo</label>
        <select className="field" defaultValue={initialTipo} onChange={(e) => pushParams({ tipo: e.target.value })}>
          <option value="">Todos</option>
          <option value="VENTA">Venta</option>
          <option value="COMPRA">Compra</option>
        </select>
      </div>
      <div className="filter-field">
        <label className="filter-label">Empresa</label>
        <select className="field" defaultValue={initialEmpresaId} onChange={(e) => pushParams({ empresaId: e.target.value })}>
          <option value="">Todas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
