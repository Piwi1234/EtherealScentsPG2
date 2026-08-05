"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function ProformaFiltros({ initialTipo, initialEstado }: { initialTipo: string; initialEstado: string }) {
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
        <label className="filter-label">Tipo</label>
        <select className="field" defaultValue={initialTipo} onChange={(e) => pushParams({ tipo: e.target.value })}>
          <option value="">Todos</option>
          <option value="VENTA">Venta</option>
          <option value="COMPRA">Compra</option>
        </select>
      </div>
      <div className="filter-field">
        <label className="filter-label">Estado</label>
        <select className="field" defaultValue={initialEstado} onChange={(e) => pushParams({ estado: e.target.value })}>
          <option value="">Todos</option>
          <option value="BORRADOR">Borrador</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="APROBADA">Aprobada</option>
          <option value="COMPLETADA">Completada</option>
          <option value="RECHAZADA">Rechazada</option>
          <option value="ANULADA">Anulada</option>
        </select>
      </div>
    </div>
  );
}
