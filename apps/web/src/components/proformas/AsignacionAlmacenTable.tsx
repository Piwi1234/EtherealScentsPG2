import Link from "next/link";
import type { Proforma } from "../../lib/types";
import { CLASES_PEDIDO, LABELS_PEDIDO } from "./seguimiento-estados";

/**
 * Desglose por línea de lo que se reservó al aprobar una VENTA (solo VENTA — resultado de reservar
 * contra el único almacén de la proforma). Presentacional puro: la aprobación ya generó las
 * asignaciones en el backend, acá solo se muestran. `origen=EN_TRANSITO` es lo reservado por adelantado contra un envío en camino; `origen=PROCURA` marca cantidad que no había en
 * stock — se resuelve sola más adelante, cuando se completa una compra que trae stock para esa
 * variante+almacén (ver proforma-completion.service.ts).
 */
export function AsignacionAlmacenTable({ proforma }: { proforma: Proforma }) {
  // Las asignaciones en 0 (Procura ya resuelta o reserva liberada) son solo historial interno: no se muestran.
  const detalles = proforma.detalles.map((d) => ({ ...d, asignaciones: d.asignaciones.filter((a) => a.cantidad > 0) }));
  const lineasConAsignacion = detalles.filter((d) => d.asignaciones.length > 0);

  if (lineasConAsignacion.length === 0) return null;

  return (
    <div className="table-scroll">
      <table className="table table-minimal table-compact">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Origen</th>
            <th className="num">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {lineasConAsignacion.map((detalle) =>
            detalle.asignaciones.map((asig) => (
              <tr key={asig.id}>
                <td className="cell-primary">{detalle.variante.product.name}</td>
                <td>
                  {asig.origen === "STOCK" ? (
                    <span>Stock — {asig.almacen?.nombre ?? "—"}</span>
                  ) : asig.origen === "EN_TRANSITO" ? (
                    <span>
                      <span className="badge badge-muted">En tránsito</span> — {asig.almacen?.nombre ?? "—"}
                      <div className="cell-muted" style={{ fontSize: 12 }}>Reservado en mercadería en camino; se puede completar cuando llegue. Si ya hay stock disponible, usa «Reservar stock» para tomarlo de ahí.</div>
                    </span>
                  ) : asig.estadoPedido && asig.estadoPedido !== "SIN_COMPRA" && asig.compraDetalle ? (
                    <span>
                      <span className={CLASES_PEDIDO[asig.estadoPedido]}>{LABELS_PEDIDO[asig.estadoPedido]}</span>
                      <div className="cell-muted" style={{ fontSize: 12 }}>
                        {asig.estadoPedido === "EN_PREPARACION" ? "Compra " : `${asig.recogidas ?? 0} de ${asig.cantidad} recogidas · ${asig.enviadas ?? 0} enviadas · compra `}
                        <Link href={`/dashboard/proformas/${asig.compraDetalle.proforma.id}`} className="link-button">
                          {asig.compraDetalle.proforma.codigo}
                        </Link>
                      </div>
                    </span>
                  ) : (
                    <span>
                      <span className="badge badge-muted">Sin compra</span>
                      <div className="cell-muted" style={{ fontSize: 12 }}>Falta comprarlo.</div>
                    </span>
                  )}
                </td>
                <td className="num">{asig.cantidad}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
