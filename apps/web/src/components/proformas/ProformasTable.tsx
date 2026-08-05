"use client";

import { useRouter } from "next/navigation";
import type { Proforma } from "../../lib/types";
import { EstadoBadge } from "./EstadoBadge";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

export function ProformasTable({ proformas }: { proformas: Proforma[] }) {
  const router = useRouter();

  return (
    <table className="table table-minimal">
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Empresa</th>
          <th>Cliente / Almacén</th>
          <th>Estado</th>
          <th>Fecha</th>
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
            <td className="cell-primary">{proforma.tipo === "VENTA" ? "Venta" : "Compra"}</td>
            <td>{proforma.empresa.nombre}</td>
            <td className="cell-muted">
              {proforma.tipo === "VENTA" ? proforma.cliente?.nombre ?? "—" : proforma.almacenRecepcion?.nombre ?? "—"}
            </td>
            <td>
              <EstadoBadge estado={proforma.estado} />
            </td>
            <td className="cell-muted">{formatDate(proforma.fecha)}</td>
            <td className="num">{proforma.detalles.length}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
