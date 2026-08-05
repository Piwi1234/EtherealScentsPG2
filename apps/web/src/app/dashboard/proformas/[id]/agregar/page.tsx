import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { apiGetServer } from "../../../../../lib/api-server";
import { ApiError } from "../../../../../lib/api";
import type { Proforma } from "../../../../../lib/types";
import { AgregarProductoBrowser } from "../../../../../components/proformas/AgregarProductoBrowser";

export default async function AgregarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let proforma: Proforma;
  try {
    proforma = await apiGetServer<Proforma>(`/proformas/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  if (proforma.estado !== "BORRADOR" && proforma.estado !== "PENDIENTE") {
    redirect(`/dashboard/proformas/${id}`);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>
          Agregar producto — proforma de {proforma.tipo === "VENTA" ? "venta" : "compra"}
        </h1>
        <Link href={`/dashboard/proformas/${id}`} className="link-button">
          ← Volver a la proforma
        </Link>
      </div>
      <AgregarProductoBrowser proformaId={id} tipo={proforma.tipo} />
    </div>
  );
}
