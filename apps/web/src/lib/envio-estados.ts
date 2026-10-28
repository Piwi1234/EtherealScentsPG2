import type { EstadoEnvio } from "./types";

export const ESTADO_ENVIO_LABEL: Record<EstadoEnvio, string> = {
  ARMANDO: "Armando",
  EN_TRANSITO: "Enviado",
  RECIBIDO: "Recibido",
  ANULADO: "Anulado",
};

/** Clases de .badge ya existentes (badge-enviado = azul, badge-success = verde, badge-muted = neutro/terminal). */
export const ESTADO_ENVIO_CLASE: Record<EstadoEnvio, string> = {
  ARMANDO: "badge-muted",
  EN_TRANSITO: "badge-enviado",
  RECIBIDO: "badge-success",
  ANULADO: "badge-muted",
};
