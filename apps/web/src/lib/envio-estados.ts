import type { EstadoEnvio } from "./types";

export const ESTADO_ENVIO_LABEL: Record<EstadoEnvio, string> = {
  ARMANDO: "Armando",
  EN_TRANSITO: "En tránsito",
  RECIBIDO: "Recibido",
  ANULADO: "Anulado",
};

/** Clases de .badge ya existentes (badge-accent = activo/positivo, badge-muted = neutro/terminal). */
export const ESTADO_ENVIO_CLASE: Record<EstadoEnvio, string> = {
  ARMANDO: "badge-muted",
  EN_TRANSITO: "badge-accent",
  RECIBIDO: "badge-accent",
  ANULADO: "badge-muted",
};
