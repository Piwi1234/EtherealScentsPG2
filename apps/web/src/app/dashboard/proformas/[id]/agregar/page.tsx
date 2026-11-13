import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { apiGetServer } from "../../../../../lib/api-server";
import { ApiError } from "../../../../../lib/api";
import type { Proforma } from "../../../../../lib/types";
import { AgregarProductoBrowser } from "../../../../../components/proformas/AgregarProductoBrowser";
import { AgregarVentaTabs } from "../../../../../components/proformas/AgregarVentaTabs";

export default async function AgregarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let proforma: Proforma;
  try {
    proforma = await apiGetServer<Proforma>(`/proformas/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  if (proforma.estado !== "BORRADOR") {
    redirect(`/dashboard/proformas/${id}`);
  }

  // Piezas ya cargadas por variante (las líneas de venta en ml no se cuentan: van por presentación).
  const cantidadesIniciales: Record<string, number> = {};
  for (const d of proforma.detalles) {
    if (d.variante?.unidad === "ML" && proforma.tipo === "VENTA") continue;
    cantidadesIniciales[d.varianteId] = (cantidadesIniciales[d.varianteId] ?? 0) + d.cantidad;
  }

  // Total de la nota: suma de líneas menos el descuento (el descuento ya viene repartido en descuentoGeneral).
  const totalNota = Math.max(0, proforma.detalles.reduce((n, d) => n + Number(d.subtotal ?? 0), 0) - Number(proforma.descuentoGeneral ?? 0));

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
      {proforma.tipo === "VENTA" ? (
        <AgregarVentaTabs proformaId={id} tipo={proforma.tipo} cantidadesIniciales={cantidadesIniciales} lineas={proforma.detalles.length} total={totalNota} />
      ) : (
        <AgregarProductoBrowser proformaId={id} tipo={proforma.tipo} cantidadesIniciales={cantidadesIniciales} />
      )}
    </div>
  );
}
