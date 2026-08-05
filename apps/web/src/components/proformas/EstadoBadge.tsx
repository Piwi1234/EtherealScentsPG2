import type { EstadoProforma } from "../../lib/types";

const LABELS: Record<EstadoProforma, string> = {
  BORRADOR: "Borrador",
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  COMPLETADA: "Completada",
  RECHAZADA: "Rechazada",
  ANULADA: "Anulada",
};

const CLASSES: Record<EstadoProforma, string> = {
  BORRADOR: "badge badge-muted",
  PENDIENTE: "badge",
  APROBADA: "badge badge-accent",
  COMPLETADA: "badge badge-accent",
  RECHAZADA: "badge badge-danger",
  ANULADA: "badge badge-danger",
};

export function EstadoBadge({ estado }: { estado: EstadoProforma }) {
  return <span className={CLASSES[estado]}>{LABELS[estado]}</span>;
}
