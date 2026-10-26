import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { apiGetServer } from "../../../../../../lib/api-server";
import { ApiError } from "../../../../../../lib/api";
import type { SolicitudStock } from "../../../../../../lib/types";
import { AgregarProductoBrowser } from "../../../../../../components/proformas/AgregarProductoBrowser";

export default async function AgregarProductoSolicitudPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let solicitud: SolicitudStock;
  try {
    solicitud = await apiGetServer<SolicitudStock>(`/solicitudes-stock/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  if (solicitud.estado !== "ABIERTA") redirect(`/dashboard/stock/solicitudes/${id}`);

  // Unidades que la solicitud ya tiene por producto, para no duplicar líneas.
  const cantidadesIniciales: Record<string, number> = {};
  for (const l of solicitud.lineas) cantidadesIniciales[l.variante.id] = (cantidadesIniciales[l.variante.id] ?? 0) + l.cantidad;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Agregar producto — solicitud {solicitud.codigo}</h1>
        <Link href={`/dashboard/stock/solicitudes/${id}`} className="link-button">
          ← Volver a la solicitud
        </Link>
      </div>
      <AgregarProductoBrowser proformaId={id} tipo="COMPRA" modo="SOLICITUD" cantidadesIniciales={cantidadesIniciales} />
    </div>
  );
}
