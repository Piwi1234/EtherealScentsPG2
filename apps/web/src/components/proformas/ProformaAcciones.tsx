"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, anularProforma, aprobarProforma, completarProforma, deleteProforma } from "../../lib/api";
import type { Almacen, EstadoProforma, TipoProforma } from "../../lib/types";
import { Modal } from "../Modal";
import { AlmacenSelector } from "./selectors";

type Transicion = "aprobar" | "anular" | "eliminar";

const PERMITIDAS: Record<Transicion, EstadoProforma[]> = {
  aprobar: ["BORRADOR"],
  anular: ["APROBADA"],
  eliminar: ["BORRADOR"],
};

/**
 * Botones de transición de estado. "Completar" no vive acá: para COMPRA es un modal simple (pide
 * almacén) y para VENTA navega a una página propia (reparto manual de lotes) — ver
 * `/dashboard/proformas/[id]/completar`. El backend sigue siendo la fuente de verdad de qué
 * transiciones son válidas (rechaza con 409 si no corresponde); acá solo se evita el click inútil.
 */
export function ProformaAcciones({
  proformaId,
  estado,
  tipo,
  almacenes,
}: {
  proformaId: string;
  estado: EstadoProforma;
  tipo: TipoProforma;
  almacenes: Almacen[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<Transicion | "completar" | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"aprobar" | "anular" | "eliminar" | "completar" | null>(null);
  const [nota, setNota] = useState("");
  const [almacenId, setAlmacenId] = useState("");

  const puede = (t: Transicion) => PERMITIDAS[t].includes(estado);
  const puedeCompletar = estado === "APROBADA";

  function abrirModal(m: "aprobar" | "anular" | "eliminar" | "completar") {
    setError("");
    setAlmacenId("");
    setNota("");
    setModal(m);
  }

  async function ejecutarAprobar() {
    if (tipo === "VENTA" && !almacenId) {
      setError("Elegí el almacén contra el que se reserva stock.");
      return;
    }
    setSubmitting("aprobar");
    setError("");
    try {
      await aprobarProforma(proformaId, tipo === "VENTA" ? { almacenId } : {});
      setModal(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(null);
    }
  }

  async function ejecutarAnular() {
    setSubmitting("anular");
    setError("");
    try {
      await anularProforma(proformaId, nota || undefined);
      setModal(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(null);
    }
  }

  async function ejecutarEliminar() {
    setSubmitting("eliminar");
    setError("");
    try {
      await deleteProforma(proformaId);
      router.push("/dashboard/proformas");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setSubmitting(null);
    }
  }

  function irACompletar() {
    if (tipo === "VENTA") {
      router.push(`/dashboard/proformas/${proformaId}/completar`);
    } else {
      abrirModal("completar");
    }
  }

  if (estado === "COMPLETADA" || estado === "ANULADA") {
    return null;
  }

  return (
    <div>
      <div className="row-actions" style={{ justifyContent: "flex-start" }}>
        {puede("aprobar") && (
          <button
            type="button"
            className="action-btn"
            onClick={() => (tipo === "VENTA" ? abrirModal("aprobar") : ejecutarAprobar())}
            disabled={submitting !== null}
          >
            {submitting === "aprobar" ? "Aprobando..." : "Aprobar"}
          </button>
        )}
        {puedeCompletar && (
          <button type="button" className="action-btn" onClick={irACompletar} disabled={submitting !== null}>
            Completar
          </button>
        )}
        {puede("anular") && (
          <button type="button" className="action-btn danger" onClick={() => abrirModal("anular")} disabled={submitting !== null}>
            Anular
          </button>
        )}
        {puede("eliminar") && (
          <button type="button" className="action-btn danger" onClick={() => abrirModal("eliminar")} disabled={submitting !== null}>
            Eliminar
          </button>
        )}
      </div>

      {error && !modal && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}

      {modal === "aprobar" && (
        <Modal title="Aprobar proforma" onClose={() => setModal(null)}>
          <p>Elegí el almacén contra el que se va a reservar stock para esta venta.</p>
          <div className="filter-field" style={{ marginBottom: 12 }}>
            <label className="filter-label">Almacén</label>
            <AlmacenSelector options={almacenes} value={almacenId} onChange={setAlmacenId} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="button" className="link-button" onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button type="button" className="button" onClick={ejecutarAprobar} disabled={submitting !== null}>
              {submitting === "aprobar" ? "Aprobando..." : "Aprobar"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "anular" && (
        <Modal title="Anular proforma" onClose={() => setModal(null)}>
          <p>¿Seguro que querés anular esta proforma? Se liberan las reservas de stock hechas al aprobar.</p>
          <div className="filter-field" style={{ marginBottom: 12 }}>
            <label className="filter-label">Motivo (opcional)</label>
            <input className="field" value={nota} onChange={(e) => setNota(e.target.value)} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="button" className="link-button" onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button type="button" className="button" onClick={ejecutarAnular} disabled={submitting !== null}>
              {submitting === "anular" ? "Guardando..." : "Confirmar"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "eliminar" && (
        <Modal title="Eliminar proforma" onClose={() => setModal(null)}>
          <p>¿Seguro que querés eliminar esta proforma? Esta acción no se puede deshacer.</p>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="button" className="link-button" onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button type="button" className="button" onClick={ejecutarEliminar} disabled={submitting !== null}>
              {submitting === "eliminar" ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </Modal>
      )}

      {modal === "completar" && (
        <ModalCompletarCompra
          proformaId={proformaId}
          almacenes={almacenes}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ModalCompletarCompra({
  proformaId,
  almacenes,
  onClose,
  onDone,
}: {
  proformaId: string;
  almacenes: Almacen[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [almacenId, setAlmacenId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function confirmar() {
    if (!almacenId) {
      setError("Elegí el almacén que recibe la mercadería.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await completarProforma(proformaId, { almacenId });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Completar proforma" onClose={onClose}>
      <p>Elegí el almacén que recibe la mercadería.</p>
      <div className="filter-field" style={{ marginBottom: 12 }}>
        <label className="filter-label">Almacén</label>
        <AlmacenSelector options={almacenes} value={almacenId} onChange={setAlmacenId} />
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="form-actions">
        <button type="button" className="link-button" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="button" onClick={confirmar} disabled={submitting}>
          {submitting ? "Completando..." : "Completar"}
        </button>
      </div>
    </Modal>
  );
}
