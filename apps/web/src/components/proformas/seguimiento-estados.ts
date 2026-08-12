import type { EstadoSeguimientoProcura } from "../../lib/types";

export const ORDEN_SEGUIMIENTO: EstadoSeguimientoProcura[] = ["PENDIENTE", "COMPRADO", "ENVIADO"];

export const LABELS_SEGUIMIENTO: Record<EstadoSeguimientoProcura, string> = {
  PENDIENTE: "Pendiente",
  COMPRADO: "Comprado",
  ENVIADO: "Enviado",
};
