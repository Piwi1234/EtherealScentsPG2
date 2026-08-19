import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { apiGetServer } from "../../../../../lib/api-server";
import { ApiError } from "../../../../../lib/api";
import type { Cartera, Proforma } from "../../../../../lib/types";
import { CompletarVentaForm } from "../../../../../components/proformas/CompletarVentaForm";

export default async function CompletarVentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let proforma: Proforma;
  try {
    proforma = await apiGetServer<Proforma>(`/proformas/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const carterasBs = await apiGetServer<Cartera[]>("/contabilidad/carteras?moneda=BS&activo=true");

  const hayProcuraPendiente = proforma.detalles.some((d) =>
    d.asignaciones.some((a) => a.origen === "PROCURA" && a.cantidad > 0),
  );

  // COMPRA se completa con un modal simple (pide almacén) desde ProformaAcciones — esta pantalla es
  // solo para VENTA, y solo si ya no queda Procura pendiente por resolver.
  if (proforma.tipo !== "VENTA" || proforma.estado !== "APROBADA" || hayProcuraPendiente) {
    redirect(`/dashboard/proformas/${id}`);
  }

  return (
    <div className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Completar proforma de venta</h1>
        <Link href={`/dashboard/proformas/${id}`} className="link-button">
          ← Volver a la proforma
        </Link>
      </div>
      <CompletarVentaForm proforma={proforma} carterasBs={carterasBs} />
    </div>
  );
}
