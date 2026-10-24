import type { EstadoPedido } from "../../lib/types";

/** Estado DERIVADO de un pedido de cliente según la compra/envío que lo cubre (ver
 * derivarEstadoPedido en seguimiento.service.ts). */
export const LABELS_PEDIDO: Record<EstadoPedido, string> = {
  SIN_COMPRA: "Sin compra",
  EN_PREPARACION: "Compra en preparación",
  COMPRADO: "Comprado",
  EN_TRANSITO: "En tránsito",
};

export const CLASES_PEDIDO: Record<EstadoPedido, string> = {
  SIN_COMPRA: "badge badge-muted",
  EN_PREPARACION: "badge badge-muted",
  COMPRADO: "badge badge-accent",
  EN_TRANSITO: "badge badge-accent",
};

export const LABELS_STOCK: Record<"COMPRADO" | "EN_TRANSITO", string> = {
  COMPRADO: "Comprado",
  EN_TRANSITO: "En tránsito",
};
