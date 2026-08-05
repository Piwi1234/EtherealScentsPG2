import type { Proforma } from "../../lib/types";

/**
 * Desglose de reparto por almacén de cada línea (solo VENTA — es el resultado del algoritmo de
 * reparto por proximidad al aprobar). Presentacional puro: la aprobación ya generó las asignaciones
 * en el backend, acá solo se muestran. `origen=PROCURA` marca cantidad que no había en stock y se
 * compra sobre pedido en el momento.
 */
export function AsignacionAlmacenTable({ proforma }: { proforma: Proforma }) {
  const lineasConAsignacion = proforma.detalles.filter((d) => d.asignaciones.length > 0);

  if (lineasConAsignacion.length === 0) return null;

  return (
    <div className="table-scroll">
      <table className="table table-minimal">
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
                  ) : (
                    <span className="badge badge-muted">Procura</span>
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
