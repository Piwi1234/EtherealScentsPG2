import type { EstadoProforma } from "../../lib/types";

const LABELS: Record<EstadoProforma, string> = {
  BORRADOR: "Borrador",
  APROBADA: "Aprobada",
  COMPLETADA: "Completada",
  ANULADA: "Anulada",
};

const CLASSES: Record<EstadoProforma, string> = {
  BORRADOR: "badge badge-muted",
  APROBADA: "badge badge-accent",
  COMPLETADA: "badge badge-accent",
  ANULADA: "badge badge-danger",
};

export function EstadoBadge({ estado }: { estado: EstadoProforma }) {
  return <span className={CLASSES[estado]}>{LABELS[estado]}</span>;
}
