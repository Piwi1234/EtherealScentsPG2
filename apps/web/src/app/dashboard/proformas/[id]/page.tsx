import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGetServer } from "../../../../lib/api-server";
import { ApiError } from "../../../../lib/api";
import type { Almacen, Ciudad, Cliente, Empresa, Page, Proforma } from "../../../../lib/types";
import { EstadoBadge } from "../../../../components/proformas/EstadoBadge";
import { EstadoHistorialTimeline } from "../../../../components/proformas/EstadoHistorialTimeline";
import { ProformaHeaderEditor } from "../../../../components/proformas/ProformaHeaderEditor";
import { ProformaDetalleTable } from "../../../../components/proformas/ProformaDetalleTable";
import { AsignacionAlmacenTable } from "../../../../components/proformas/AsignacionAlmacenTable";
import { SeguimientoTracker } from "../../../../components/proformas/SeguimientoTracker";
import { ProformaAcciones } from "../../../../components/proformas/ProformaAcciones";
import { AgregarLinea } from "../../../../components/proformas/AgregarLinea";

export default async function ProformaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let proforma: Proforma;
  try {
    proforma = await apiGetServer<Proforma>(`/proformas/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const editableHeader = proforma.estado === "BORRADOR";
  const editableDetalle = proforma.estado === "BORRADOR" || proforma.estado === "PENDIENTE";
  const mostrarSeguimiento = proforma.estado === "APROBADA" || proforma.estado === "COMPLETADA";
  const mostrarAsignaciones = proforma.tipo === "VENTA" && mostrarSeguimiento;

  const [empresasPage, clientesPage, almacenesPage, ciudadesPage] = await Promise.all([
    apiGetServer<Page<Empresa>>("/empresas?pageSize=100"),
    proforma.tipo === "VENTA"
      ? apiGetServer<Page<Cliente>>("/clientes?activo=true&limit=200")
      : Promise.resolve<Page<Cliente>>({ items: [], total: 0, page: 1, pageSize: 0 }),
    proforma.tipo === "COMPRA"
      ? apiGetServer<Page<Almacen>>("/almacenes?pageSize=200")
      : Promise.resolve<Page<Almacen>>({ items: [], total: 0, page: 1, pageSize: 0 }),
    apiGetServer<Page<Ciudad>>("/ciudades?pageSize=100"),
  ]);

  return (
    <div className="card" style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>
            Proforma de {proforma.tipo === "VENTA" ? "venta" : "compra"}
          </h1>
          <EstadoBadge estado={proforma.estado} />
        </div>
        <Link href="/dashboard/proformas" className="link-button">
          Volver
        </Link>
      </div>

      <ProformaHeaderEditor
        proforma={proforma}
        editable={editableHeader}
        empresas={empresasPage.items.filter((e) => e.activo)}
        clientes={clientesPage.items}
        almacenes={almacenesPage.items.filter((a) => a.activo)}
        ciudades={ciudadesPage.items}
      />

      <ProformaAcciones proformaId={proforma.id} estado={proforma.estado} />

      <h2 style={{ fontSize: 16, margin: "24px 0 12px" }}>Líneas</h2>
      <ProformaDetalleTable proforma={proforma} editable={editableDetalle} />

      {editableDetalle && (
        <div style={{ marginTop: 16 }}>
          <AgregarLinea proformaId={proforma.id} tipo={proforma.tipo} />
        </div>
      )}

      {mostrarAsignaciones && (
        <>
          <h2 style={{ fontSize: 16, margin: "24px 0 12px" }}>Reparto por almacén</h2>
          <AsignacionAlmacenTable proforma={proforma} />
        </>
      )}

      {mostrarSeguimiento && (
        <>
          <h2 style={{ fontSize: 16, margin: "24px 0 12px" }}>Seguimiento interno</h2>
          <SeguimientoTracker detalles={proforma.detalles} />
        </>
      )}

      <h2 style={{ fontSize: 16, margin: "24px 0 12px" }}>Historial</h2>
      <EstadoHistorialTimeline historial={proforma.historial} />
    </div>
  );
}
