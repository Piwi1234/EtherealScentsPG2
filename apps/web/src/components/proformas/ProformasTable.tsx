"use client";

import { useRouter } from "next/navigation";
import type { Proforma } from "../../lib/types";
import { EstadoBadge } from "./EstadoBadge";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

export function ProformasTable({ proformas, mostrarVendedor }: { proformas: Proforma[]; mostrarVendedor: boolean }) {
  const router = useRouter();

  return (
    <table className="table table-minimal">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Empresa</th>
          <th>Almacén</th>
          <th>Cliente / Proveedor</th>
          {mostrarVendedor && <th>Vendedor</th>}
          <th>Estado</th>
          <th className="num">Líneas</th>
        </tr>
      </thead>
      <tbody>
        {proformas.map((proforma) => (
          <tr
            key={proforma.id}
            onClick={() => router.push(`/dashboard/proformas/${proforma.id}`)}
            style={{ cursor: "pointer" }}
          >
            <td className="cell-muted">{formatDate(proforma.fecha)}</td>
            <td className="cell-primary">{proforma.tipo === "VENTA" ? "Venta" : "Compra"}</td>
            <td>{proforma.empresa.nombre}</td>
            <td className="cell-muted">{proforma.almacen?.nombre ?? "—"}</td>
            <td className="cell-muted">
              {proforma.tipo === "VENTA" ? proforma.cliente?.nombre ?? "—" : proforma.proveedor?.nombre ?? "—"}
            </td>
            {mostrarVendedor && <td className="cell-muted">{proforma.tipo === "VENTA" ? proforma.creadoPor.nombre : "—"}</td>}
            <td>
              <EstadoBadge estado={proforma.estado} />
            </td>
            <td className="num">{proforma.detalles.length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
