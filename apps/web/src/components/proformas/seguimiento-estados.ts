import type { EstadoPedido } from "../../lib/types";

/** Estado DERIVADO de un pedido de cliente según la compra/envío que lo cubre (ver
 * derivarEstadoPedido en seguimiento.service.ts). */
export const LABELS_PEDIDO: Record<EstadoPedido, string> = {
  SIN_COMPRA: "Sin compra",
  EN_PREPARACION: "Compra en preparación",
  COMPRADO: "Comprado",
  RECOGIDO: "Recogido",
  EN_TRANSITO: "Enviado",
};

export const CLASES_PEDIDO: Record<EstadoPedido, string> = {
  SIN_COMPRA: "badge badge-muted",
  EN_PREPARACION: "badge badge-muted",
  COMPRADO: "badge badge-accent",
  RECOGIDO: "badge badge-info",
  EN_TRANSITO: "badge badge-accent",
};

export const LABELS_STOCK: Record<"COMPRADO" | "RECOGIDO" | "EN_TRANSITO", string> = {
  COMPRADO: "Comprado",
  RECOGIDO: "Recogido",
  EN_TRANSITO: "Enviado",
};

/** Estado derivado de una línea de solicitud de stock (igual que un pedido, más "Recibida" cuando ya llegó). */
export const LABELS_LINEA_SOLICITUD: Record<EstadoPedido | "RECIBIDA", string> = {
  ...LABELS_PEDIDO,
  RECIBIDA: "Recibida",
};

export const CLASES_LINEA_SOLICITUD: Record<EstadoPedido | "RECIBIDA", string> = {
  ...CLASES_PEDIDO,
  RECIBIDA: "badge badge-success",
};

export const LABELS_SOLICITUD: Record<"ABIERTA" | "CERRADA" | "CANCELADA", string> = {
  ABIERTA: "Abierta",
  CERRADA: "Cerrada",
  CANCELADA: "Cancelada",
};

export const CLASES_SOLICITUD: Record<"ABIERTA" | "CERRADA" | "CANCELADA", string> = {
  ABIERTA: "badge badge-accent",
  CERRADA: "badge badge-success",
  CANCELADA: "badge badge-danger",
};
