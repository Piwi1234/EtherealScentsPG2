import type { EstadoSeguimiento } from "../../lib/types";

export const ORDEN_SEGUIMIENTO: EstadoSeguimiento[] = ["PENDIENTE", "COMPRADO", "ENVIADO", "RECIBIDO"];

export const LABELS_SEGUIMIENTO: Record<EstadoSeguimiento, string> = {
  PENDIENTE: "Pendiente",
  COMPRADO: "Comprado",
  ENVIADO: "Enviado",
  RECIBIDO: "Recibido",
};

/** Siguiente estado en la secuencia, o null si ya está en RECIBIDO (terminal). */
export function siguienteEstadoSeguimiento(actual: EstadoSeguimiento): EstadoSeguimiento | null {
  const idx = ORDEN_SEGUIMIENTO.indexOf(actual);
  return idx < ORDEN_SEGUIMIENTO.length - 1 ? ORDEN_SEGUIMIENTO[idx + 1] : null;
}
