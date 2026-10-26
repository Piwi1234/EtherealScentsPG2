import type { Proforma } from "../../lib/types";

/**
 * Estado de entrega de una VENTA aprobada, derivado de lo que reservó al aprobar: "Con faltante" si algo
 * quedó en Procura, "En tránsito" si solo hay reservas de mercadería que viaja, y "Lista para completar"
 * si todo está reservado en stock físico. No existe en otros estados ni en compras.
 */
export function EntregaBadge({ proforma }: { proforma: Proforma }) {
  if (proforma.tipo !== "VENTA" || proforma.estado !== "APROBADA") return null;

  let faltante = 0;
  let transito = 0;
  for (const d of proforma.detalles) {
    for (const a of d.asignaciones) {
      if (a.origen === "PROCURA") faltante += a.cantidad;
      else if (a.origen === "EN_TRANSITO") transito += a.cantidad;
    }
  }

  if (faltante > 0) {
    return (
      <span className="badge badge-warn entrega-badge" title="Hay productos sin stock: falta comprarlos o esperar que lleguen.">
        Con faltante · {faltante}
      </span>
    );
  }
  if (transito > 0) {
    return (
      <span className="badge badge-info entrega-badge" title="Reservada contra mercadería que viaja en un envío.">
        En tránsito · {transito}
      </span>
    );
  }
  return (
    <span className="badge badge-lista entrega-badge" title="Todo está reservado en stock físico: se puede completar.">
      Lista para completar
    </span>
  );
}
