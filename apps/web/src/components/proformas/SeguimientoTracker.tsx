"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createSeguimiento } from "../../lib/api";
import type { EstadoSeguimiento, ProformaDetalle } from "../../lib/types";

const ORDEN: EstadoSeguimiento[] = ["PENDIENTE", "COMPRADO", "ENVIADO", "RECIBIDO"];

const LABELS: Record<EstadoSeguimiento, string> = {
  PENDIENTE: "Pendiente",
  COMPRADO: "Comprado",
  ENVIADO: "Enviado",
  RECIBIDO: "Recibido",
};

function estadoActual(detalle: ProformaDetalle): EstadoSeguimiento {
  return detalle.seguimientos[0]?.estado ?? "PENDIENTE";
}

function LineaSeguimiento({ detalle }: { detalle: ProformaDetalle }) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const actual = estadoActual(detalle);
  const idx = ORDEN.indexOf(actual);
  const siguiente = idx < ORDEN.length - 1 ? ORDEN[idx + 1] : null;

  async function handleAvanzar() {
    if (!siguiente) return;
    setSubmitting(true);
    setError("");
    try {
      await createSeguimiento(detalle.id, { estado: siguiente, nota: nota || undefined });
      setNota("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span className="cell-primary">{detalle.variante.product.name}</span>
        <span className="badge badge-accent">{LABELS[actual]}</span>
      </div>

      {siguiente && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="field"
            placeholder="Nota (opcional)"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            style={{ flex: 1, minWidth: 160 }}
          />
          <button type="button" className="action-btn" onClick={handleAvanzar} disabled={submitting}>
            {submitting ? "Guardando..." : `Marcar como ${LABELS[siguiente]}`}
          </button>
        </div>
      )}

      {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}

      {detalle.seguimientos.length > 0 && (
        <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
          {detalle.seguimientos.map((s) => (
            <li key={s.id} className="cell-muted" style={{ fontSize: 12, marginTop: 4 }}>
              {LABELS[s.estado]} — {new Date(s.fecha).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" })} — {s.usuario.nombre}
              {s.nota ? ` — "${s.nota}"` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Seguimiento interno por línea (PENDIENTE→COMPRADO→ENVIADO→RECIBIDO), independiente del estado de
 * la proforma en sí — solo visible cuando la proforma ya está APROBADA o COMPLETADA (antes no tiene
 * sentido: todavía no hay nada que comprar/enviar).
 */
export function SeguimientoTracker({ detalles }: { detalles: ProformaDetalle[] }) {
  if (detalles.length === 0) return null;

  return (
    <div>
      {detalles.map((detalle) => (
        <LineaSeguimiento key={detalle.id} detalle={detalle} />
      ))}
    </div>
  );
}
