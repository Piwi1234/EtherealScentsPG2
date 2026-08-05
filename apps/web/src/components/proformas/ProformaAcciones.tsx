"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  anularProforma,
  aprobarProforma,
  completarProforma,
  enviarProforma,
  rechazarProforma,
} from "../../lib/api";
import type { EstadoProforma } from "../../lib/types";
import { Modal } from "../Modal";

type Transicion = "enviar" | "aprobar" | "rechazar" | "anular" | "completar";

const PERMITIDAS: Record<Transicion, EstadoProforma[]> = {
  enviar: ["BORRADOR"],
  aprobar: ["PENDIENTE"],
  completar: ["APROBADA"],
  rechazar: ["BORRADOR", "PENDIENTE", "APROBADA"],
  anular: ["BORRADOR", "PENDIENTE", "APROBADA"],
};

/**
 * Botones de transición de estado — cada uno su propio POST. Se deshabilitan según el estado actual
 * reflejando las transiciones válidas del backend, que sigue siendo la fuente de verdad (rechaza con
 * 409 si no corresponde; acá solo se evita el click inútil).
 */
export function ProformaAcciones({ proformaId, estado }: { proformaId: string; estado: EstadoProforma }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<Transicion | null>(null);
  const [error, setError] = useState("");
  const [motivo, setMotivo] = useState<"rechazar" | "anular" | null>(null);
  const [nota, setNota] = useState("");

  async function ejecutar(transicion: Transicion, nota?: string) {
    setSubmitting(transicion);
    setError("");
    try {
      if (transicion === "enviar") await enviarProforma(proformaId);
      else if (transicion === "aprobar") await aprobarProforma(proformaId);
      else if (transicion === "completar") await completarProforma(proformaId);
      else if (transicion === "rechazar") await rechazarProforma(proformaId, nota);
      else if (transicion === "anular") await anularProforma(proformaId, nota);
      setMotivo(null);
      setNota("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(null);
    }
  }

  const puede = (t: Transicion) => PERMITIDAS[t].includes(estado);

  if (estado === "COMPLETADA" || estado === "RECHAZADA" || estado === "ANULADA") {
    return null;
  }

  return (
    <div>
      <div className="row-actions" style={{ justifyContent: "flex-start" }}>
        {puede("enviar") && (
          <button type="button" className="action-btn" onClick={() => ejecutar("enviar")} disabled={submitting !== null}>
            {submitting === "enviar" ? "Enviando..." : "Enviar"}
          </button>
        )}
        {puede("aprobar") && (
          <button type="button" className="action-btn" onClick={() => ejecutar("aprobar")} disabled={submitting !== null}>
            {submitting === "aprobar" ? "Aprobando..." : "Aprobar"}
          </button>
        )}
        {puede("completar") && (
          <button type="button" className="action-btn" onClick={() => ejecutar("completar")} disabled={submitting !== null}>
            {submitting === "completar" ? "Completando..." : "Completar"}
          </button>
        )}
        {puede("rechazar") && (
          <button
            type="button"
            className="action-btn danger"
            onClick={() => setMotivo("rechazar")}
            disabled={submitting !== null}
          >
            Rechazar
          </button>
        )}
        {puede("anular") && (
          <button
            type="button"
            className="action-btn danger"
            onClick={() => setMotivo("anular")}
            disabled={submitting !== null}
          >
            Anular
          </button>
        )}
      </div>

      {error && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}

      {motivo && (
        <Modal title={motivo === "rechazar" ? "Rechazar proforma" : "Anular proforma"} onClose={() => setMotivo(null)}>
          <p>
            {motivo === "rechazar"
              ? "¿Seguro que querés rechazar esta proforma?"
              : "¿Seguro que querés anular esta proforma? Si estaba aprobada, se liberan las reservas de stock."}
          </p>
          <div className="filter-field" style={{ marginBottom: 12 }}>
            <label className="filter-label">Motivo (opcional)</label>
            <input className="field" value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="button" className="link-button" onClick={() => setMotivo(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="button"
              onClick={() => ejecutar(motivo, nota || undefined)}
              disabled={submitting !== null}
            >
              {submitting ? "Guardando..." : "Confirmar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
