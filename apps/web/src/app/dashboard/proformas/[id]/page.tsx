import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGetServer } from "../../../../lib/api-server";
import { ApiError } from "../../../../lib/api";
import type { Almacen, Ciudad, Cliente, Empresa, Page, Proforma } from "../../../../lib/types";
import { EstadoBadge } from "../../../../components/proformas/EstadoBadge";
import { EstadoHistorialTimeline } from "../../../../components/proformas/EstadoHistorialTimeline";
import { ProformaHeaderEditor } from "../../../../components/proformas/ProformaHeaderEditor";
import { ProformaDetalleTable } from "../../../../components/proformas/ProformaDetalleTable";
import { ProformaTotales } from "../../../../components/proformas/ProformaTotales";
import { AsignacionAlmacenTable } from "../../../../components/proformas/AsignacionAlmacenTable";
import { ProformaAcciones } from "../../../../components/proformas/ProformaAcciones";

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
  const editableDetalle = proforma.estado === "BORRADOR";
  const mostrarAsignaciones = proforma.tipo === "VENTA" && (proforma.estado === "APROBADA" || proforma.estado === "COMPLETADA");

  const [empresasPage, clientesPage, almacenesPage, ciudadesPage] = await Promise.all([
    apiGetServer<Page<Empresa>>("/empresas?pageSize=100"),
    proforma.tipo === "VENTA"
      ? apiGetServer<Page<Cliente>>("/clientes?activo=true&limit=200")
      : Promise.resolve<Page<Cliente>>({ items: [], total: 0, page: 1, pageSize: 0 }),
    apiGetServer<Page<Almacen>>("/almacenes?pageSize=200"),
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
        ciudades={ciudadesPage.items}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 12px" }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Productos</h2>
        {editableDetalle && (
          <Link href={`/dashboard/proformas/${proforma.id}/agregar`} className="btn-cta">
            <span className="btn-cta-icon">+</span> Agregar producto
          </Link>
        )}
      </div>
      <ProformaDetalleTable proforma={proforma} editable={editableDetalle} />

      <div style={{ marginTop: 16 }}>
        <ProformaTotales proforma={proforma} editable={editableHeader} />
      </div>

      {mostrarAsignaciones && (
        <>
          <h2 style={{ fontSize: 16, margin: "24px 0 12px" }}>Reparto por almacén</h2>
          <AsignacionAlmacenTable proforma={proforma} />
        </>
      )}

      <h2 style={{ fontSize: 16, margin: "24px 0 12px" }}>Historial</h2>
      <EstadoHistorialTimeline historial={proforma.historial} />

      <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
        <ProformaAcciones
          proformaId={proforma.id}
          estado={proforma.estado}
          tipo={proforma.tipo}
          almacenes={almacenesPage.items.filter((a) => a.activo)}
        />
      </div>
    </div>
  );
}
