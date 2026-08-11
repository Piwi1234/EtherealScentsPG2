import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGetServer } from "../../../../lib/api-server";
import { ApiError } from "../../../../lib/api";
import type { Cliente, TipoDocumento } from "../../../../lib/types";
import { ClienteStatusBadge } from "../../../../components/clientes/ClienteStatusBadge";
import { ClienteOrigenBadge } from "../../../../components/clientes/ClienteOrigenBadge";
import { ClienteAcciones } from "../../../../components/clientes/ClienteAcciones";

const TIPO_DOC_LABELS: Record<TipoDocumento, string> = {
  DNI: "DNI",
  CI: "CI",
  RUC: "RUC",
  PASAPORTE: "Pasaporte",
  OTRO: "Otro",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("es-VE", { dateStyle: "long", timeStyle: "short" });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="filter-label">{label}</span>
      <p style={{ margin: "4px 0 0" }}>{value}</p>
    </div>
  );
}

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let cliente: Cliente;
  try {
    cliente = await apiGetServer<Cliente>(`/clientes/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{cliente.nombre}</h1>
        <Link href="/dashboard/clientes" className="link-button">
          Volver
        </Link>
      </div>

      {!cliente.activo && (
        <div
          style={{
            background: "rgba(198, 66, 50, 0.08)",
            border: "1px solid var(--danger)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            color: "var(--danger)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Este cliente está inactivo.
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 24, rowGap: 18 }}>
        <Field label="Tipo" value={cliente.tipo === "JURIDICA" ? "Jurídica" : "Natural"} />
        <Field label="Documento" value={`${TIPO_DOC_LABELS[cliente.tipoDocumento]} ${cliente.numeroDocumento}`} />
        <Field label="Email" value={cliente.email ?? "—"} />
        <Field label="Teléfono" value={cliente.telefono ?? "—"} />
        <Field label="Dirección" value={cliente.direccion ?? "—"} />
        <Field label="Ciudad" value={cliente.ciudadRef?.nombre ?? cliente.ciudad ?? "—"} />
        <Field label="Estado" value={<ClienteStatusBadge activo={cliente.activo} />} />
        <Field label="Origen" value={<ClienteOrigenBadge origen={cliente.origen} />} />
        <Field label="Registrado" value={formatDate(cliente.createdAt)} />
      </div>

      <ClienteAcciones clienteId={cliente.id} activo={cliente.activo} />
    </div>
  );
}
