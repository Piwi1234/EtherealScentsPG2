import type { ProformaHistorial } from "../../lib/types";
import { EstadoBadge } from "./EstadoBadge";

function formatFecha(value: string): string {
  return new Date(value).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });
}

export function EstadoHistorialTimeline({ historial }: { historial: ProformaHistorial[] }) {
  if (historial.length === 0) {
    return <p className="cell-muted">Sin historial todavía.</p>;
  }

  return (
    <div className="timeline">
      {historial.map((item) => (
        <div key={item.id} className="timeline-item">
          <span className="timeline-dot" />
          <div className="timeline-content">
            <EstadoBadge estado={item.estado} />
            <div className="timeline-meta">
              {formatFecha(item.fecha)} — {item.usuario.nombre}
            </div>
            {item.nota && <p style={{ margin: "4px 0 0", fontSize: 13 }}>{item.nota}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
