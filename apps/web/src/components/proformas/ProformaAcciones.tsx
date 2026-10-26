"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ApiError,
  anularProforma,
  aprobarProforma,
  deleteProforma,
  downloadProformaPdf,
  reservarVenta,
} from "../../lib/api";
import type { Almacen, Cartera, EstadoProforma, TipoProforma } from "../../lib/types";
import { Modal } from "../Modal";
import { AlmacenSelector, CarteraSelector } from "./selectors";

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
  codigo,
  estado,
  tipo,
  almacenes,
  montoAdelanto = 0,
  carterasBs = [],
}: {
  proformaId: string;
  codigo: string;
  estado: EstadoProforma;
  tipo: TipoProforma;
  almacenes: Almacen[];
  montoAdelanto?: number;
  carterasBs?: Cartera[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<Transicion | null>(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"aprobar" | "anular" | "eliminar" | null>(null);
  const [nota, setNota] = useState("");
  const [almacenId, setAlmacenId] = useState("");
  const [carteraId, setCarteraId] = useState("");
  const [descargando, setDescargando] = useState(false);
  const [errorPdf, setErrorPdf] = useState("");

  async function handleDescargarPdf() {
    setDescargando(true);
    setErrorPdf("");
    try {
      await downloadProformaPdf(proformaId, codigo);
    } catch (e) {
      setErrorPdf(e instanceof ApiError ? e.message : String(e));
    } finally {
      setDescargando(false);
    }
  }

  const [reservando, setReservando] = useState(false);
  const [avisoReserva, setAvisoReserva] = useState("");

  async function handleReservar() {
    setReservando(true);
    setError("");
    setAvisoReserva("");
    try {
      const r = await reservarVenta(proformaId);
      setAvisoReserva(r.unidadesReservadas > 0 ? `Se reservaron ${r.unidadesReservadas} unidad(es).` : "No hay stock libre para reservar.");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setReservando(false);
    }
  }

  const puede = (t: Transicion) => PERMITIDAS[t].includes(estado);
  const requiereCartera = tipo === "VENTA" && montoAdelanto > 0;

  function abrirModal(m: "aprobar" | "anular" | "eliminar") {
    setError("");
    setAlmacenId("");
    setCarteraId("");
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
      await aprobarProforma(proformaId, tipo === "VENTA" ? { almacenId, ...(requiereCartera && carteraId ? { carteraId } : {}) } : {});
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
      router.push("/dashboard/registros");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
      setSubmitting(null);
    }
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
        {estado === "APROBADA" && tipo === "VENTA" && (
          <button type="button" className="action-btn" onClick={handleReservar} disabled={submitting !== null || reservando}>
            {reservando ? "Reservando..." : "Reservar stock"}
          </button>
        )}
        {estado === "APROBADA" && tipo === "VENTA" && (
          <button type="button" className="action-btn" onClick={() => router.push(`/dashboard/proformas/${proformaId}/completar`)} disabled={submitting !== null}>
            Completar
          </button>
        )}
        {estado === "APROBADA" && tipo === "COMPRA" && (
          <Link href="/dashboard/stock/envios?nuevo=1" className="action-btn">
            Armar envío
          </Link>
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
        <button type="button" className="action-btn" onClick={handleDescargarPdf} disabled={descargando}>
          {descargando ? "Generando..." : "Descargar PDF"}
        </button>
      </div>

      {avisoReserva && <p className="cell-muted" style={{ marginTop: 8, fontSize: 13 }}>{avisoReserva}</p>}
      {errorPdf && <p className="error-text" style={{ marginTop: 8 }}>{errorPdf}</p>}
      {error && !modal && <p className="error-text" style={{ marginTop: 8 }}>{error}</p>}

      {modal === "aprobar" && (
        <Modal title="Aprobar proforma" onClose={() => setModal(null)}>
          <p>Elegí el almacén contra el que se va a reservar stock para esta venta.</p>
          <div className="filter-field" style={{ marginBottom: 12 }}>
            <label className="filter-label">Almacén</label>
            <AlmacenSelector options={almacenes} value={almacenId} onChange={setAlmacenId} />
          </div>
          {requiereCartera && (
            <div className="filter-field" style={{ marginBottom: 12 }}>
              <label className="filter-label">Cobrar el adelanto ahora en (opcional)</label>
              <CarteraSelector options={carterasBs} value={carteraId} onChange={setCarteraId} placeholder="— Cobrar después —" />
              <p className="cell-muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
                Si no eliges cartera, el adelanto queda pendiente y se cobra desde la sección Pagos de la proforma.
              </p>
            </div>
          )}
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

    </div>
  );
}
