"use client";

import { useRouter } from "next/navigation";
import type { Cliente, TipoDocumento } from "../../lib/types";
import { ClienteStatusBadge } from "./ClienteStatusBadge";
import { ClienteOrigenBadge } from "./ClienteOrigenBadge";

const TIPO_DOC_LABELS: Record<TipoDocumento, string> = {
  DNI: "DNI",
  CI: "CI",
  RUC: "RUC",
  PASAPORTE: "Pasaporte",
  OTRO: "Otro",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("es-VE", { year: "numeric", month: "short", day: "numeric" });
}

export function ClientesTable({ clientes }: { clientes: Cliente[] }) {
  const router = useRouter();

  return (
    <table className="table table-minimal">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Documento</th>
          <th>Email</th>
          <th>Teléfono</th>
          <th>Estado</th>
          <th>Origen</th>
          <th>Registrado</th>
        </tr>
      </thead>
      <tbody>
        {clientes.map((cliente) => (
          <tr
            key={cliente.id}
            onClick={() => router.push(`/dashboard/clientes/${cliente.id}`)}
            style={{ cursor: "pointer" }}
          >
            <td className="cell-primary">{cliente.nombre}</td>
            <td className="cell-code">
              {TIPO_DOC_LABELS[cliente.tipoDocumento]} {cliente.numeroDocumento}
            </td>
            <td className="cell-muted">{cliente.email ?? "—"}</td>
            <td className="cell-muted">{cliente.telefono ?? "—"}</td>
            <td><ClienteStatusBadge activo={cliente.activo} /></td>
            <td><ClienteOrigenBadge origen={cliente.origen} /></td>
            <td className="cell-muted">{formatDate(cliente.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
