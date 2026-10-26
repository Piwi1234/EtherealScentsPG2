import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGetServer } from "../../../../lib/api-server";
import { ApiError } from "../../../../lib/api";
import type { Almacen, Cartera, Ciudad, Empresa, Page, Proforma, Proveedor } from "../../../../lib/types";
import { EstadoBadge } from "../../../../components/proformas/EstadoBadge";
import { EntregaBadge } from "../../../../components/proformas/EntregaBadge";
import { EstadoHistorialTimeline } from "../../../../components/proformas/EstadoHistorialTimeline";
import { ProformaHeaderEditor } from "../../../../components/proformas/ProformaHeaderEditor";
import { ProformaDetalleTable } from "../../../../components/proformas/ProformaDetalleTable";
import { ProformaTotales } from "../../../../components/proformas/ProformaTotales";
import { AsignacionAlmacenTable } from "../../../../components/proformas/AsignacionAlmacenTable";
import { VolverALista } from "../../../../components/proformas/VolverALista";
import { ProformaAcciones } from "../../../../components/proformas/ProformaAcciones";
import { ProformaPagos } from "../../../../components/proformas/ProformaPagos";
import { ProformaRecojos } from "../../../../components/proformas/ProformaRecojos";

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

  const [empresasPage, almacenesPage, ciudadesPage, proveedoresPage, carterasBs] = await Promise.all([
    apiGetServer<Page<Empresa>>("/empresas?pageSize=100"),
    apiGetServer<Page<Almacen>>("/almacenes?pageSize=200"),
    apiGetServer<Page<Ciudad>>("/ciudades?pageSize=100"),
    // Ya no es para la cabecera (ver ProformaHeaderEditor) — el proveedor es por línea, hace falta
    // para el selector de cada fila en ProformaDetalleTable.
    proforma.tipo === "COMPRA"
      ? apiGetServer<Page<Proveedor>>("/proveedores?activo=true&pageSize=200")
      : Promise.resolve<Page<Proveedor>>({ items: [], total: 0, page: 1, pageSize: 0 }),
    proforma.tipo === "VENTA"
      ? apiGetServer<Cartera[]>("/contabilidad/carteras?moneda=BS&activo=true")
      : Promise.resolve<Cartera[]>([]),
  ]);

  // Mismo cálculo que ProformaTotales — se usa acá solo para saber si ProformaAcciones debe pedir
  // una cartera en Bs al aprobar (adelanto > 0), no se persiste.
  const subtotal = proforma.detalles.reduce((sum, d) => sum + Number(d.subtotal), 0);
  const totalVenta = proforma.tipo === "VENTA" ? subtotal - (Number(proforma.descuentoGeneral) || 0) : subtotal;
  const porcentajeAdelanto = proforma.tipo === "VENTA" ? Number(proforma.adelantoPorcentaje) || 0 : 0;
  const montoAdelanto = totalVenta * (porcentajeAdelanto / 100);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>
            {proforma.estado === "COMPLETADA"
              ? `Nota de ${proforma.tipo === "VENTA" ? "Venta" : "Compra"}`
              : `Proforma de ${proforma.tipo === "VENTA" ? "venta" : "compra"}`}{" "}
            — {proforma.codigo}
          </h1>
          <EstadoBadge estado={proforma.estado} />
          <EntregaBadge proforma={proforma} />
        </div>
        <VolverALista />
      </div>

      <ProformaHeaderEditor
        proforma={proforma}
        editable={editableHeader}
        empresas={empresasPage.items.filter((e) => e.activo)}
        ciudades={ciudadesPage.items}
        proveedores={proveedoresPage.items}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 12px" }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Productos</h2>
        {editableDetalle && (
          <Link href={`/dashboard/proformas/${proforma.id}/agregar`} className="btn-cta">
            <span className="btn-cta-icon">+</span> Agregar producto
          </Link>
        )}
      </div>
      <ProformaDetalleTable proforma={proforma} editable={editableDetalle} proveedores={proveedoresPage.items} />

      <div style={{ marginTop: 16 }}>
        <ProformaTotales proforma={proforma} editable={editableHeader} />
      </div>

      {mostrarAsignaciones && (
        <>
          <h2 style={{ fontSize: 16, margin: "24px 0 12px" }}>Reparto por almacén</h2>
          <AsignacionAlmacenTable proforma={proforma} />
        </>
      )}

      {proforma.tipo === "VENTA" && (proforma.estado === "APROBADA" || proforma.estado === "COMPLETADA") && (
        <ProformaPagos proformaId={proforma.id} estado={proforma.estado} carterasBs={carterasBs} />
      )}

      {proforma.tipo === "COMPRA" && (proforma.estado === "APROBADA" || proforma.estado === "COMPLETADA") && <ProformaRecojos proforma={proforma} />}

      <h2 style={{ fontSize: 16, margin: "24px 0 12px" }}>Historial</h2>
      <EstadoHistorialTimeline historial={proforma.historial} />

      <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
        <ProformaAcciones
          proformaId={proforma.id}
          codigo={proforma.codigo}
          estado={proforma.estado}
          tipo={proforma.tipo}
          almacenes={almacenesPage.items.filter((a) => a.activo)}
          montoAdelanto={montoAdelanto}
          carterasBs={carterasBs}
          envioId={proforma.envioId ?? null}
        />
      </div>
    </div>
  );
}
