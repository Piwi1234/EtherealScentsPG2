import type { EstadoPedido, Proforma } from "../../lib/types";

const ORDEN: EstadoPedido[] = ["SIN_COMPRA", "EN_PREPARACION", "COMPRADO", "RECOGIDO", "EN_TRANSITO"];

const INFO: Record<EstadoPedido, { label: string; clase: string; ayuda: string }> = {
  SIN_COMPRA: { label: "Falta comprar", clase: "badge badge-warn", ayuda: "Hay productos sin stock y todavía sin compra." },
  EN_PREPARACION: { label: "Compra en preparación", clase: "badge badge-muted", ayuda: "La compra que los cubre todavía es un borrador." },
  COMPRADO: { label: "Comprado", clase: "badge badge-comprado", ayuda: "Ya se compró lo que falta; todavía no se recogió." },
  RECOGIDO: { label: "Recogido", clase: "badge badge-recogido", ayuda: "Ya se recogió lo que falta; todavía no se envió." },
  EN_TRANSITO: { label: "Enviado", clase: "badge badge-enviado", ayuda: "Lo que falta ya viaja en un envío." },
};

/**
 * Estado de entrega de una VENTA aprobada: "Lista para completar" si todo está reservado en stock físico; si no, el estado
 * de lo que falta según su compra (el más atrasado) con las unidades pendientes — así un faltante ya comprado o enviado no
 * se lee como "sin comprar". No existe en otros estados ni en compras.
 */
export function EntregaBadge({ proforma }: { proforma: Proforma }) {
  if (proforma.tipo !== "VENTA" || proforma.estado !== "APROBADA") return null;

  let pendientes = 0;
  let peor: EstadoPedido | null = null;
  for (const d of proforma.detalles) {
    for (const a of d.asignaciones) {
      if (a.cantidad <= 0) continue;
      if (a.origen === "PROCURA" || a.origen === "EN_TRANSITO") {
        pendientes += a.cantidad;
        const estado: EstadoPedido = a.origen === "EN_TRANSITO" ? "EN_TRANSITO" : a.estadoPedido ?? "SIN_COMPRA";
        if (peor === null || ORDEN.indexOf(estado) < ORDEN.indexOf(peor)) peor = estado;
      }
    }
  }

  const entregadas = proforma.detalles.reduce((n, d) => n + (d.entregas ?? []).reduce((m, e) => m + e.cantidad, 0), 0);
  const parcial =
    entregadas > 0 ? (
      <span className="badge badge-comprado entrega-badge" title="Unidades ya entregadas al cliente (entregas parciales).">
        Entregado · {entregadas}
      </span>
    ) : null;

  if (pendientes === 0 || !peor) {
    return (
      <>
        <span className="badge badge-lista entrega-badge" title="Todo está reservado en stock físico: se puede completar.">
          Lista para completar
        </span>
        {parcial}
      </>
    );
  }
  const info = INFO[peor];
  return (
    <>
      <span className={`${info.clase} entrega-badge`} title={info.ayuda}>
        {info.label} · {pendientes}
      </span>
      {parcial}
    </>
  );
}
