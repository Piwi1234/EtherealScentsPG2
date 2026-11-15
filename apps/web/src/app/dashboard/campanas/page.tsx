"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, actualizarDescripcionCampana, eliminarCampana, getCampanas, programarCampana, revertirCampana } from "../../../lib/api";
import { Modal } from "../../../components/Modal";
import { DESCRIPCION_CAMPANA_POR_DEFECTO } from "../../../lib/campana";
import type { Campana, EstadoCampana } from "../../../lib/types";

const ESTADO: Record<EstadoCampana, { texto: string; clase: string }> = {
  BORRADOR: { texto: "Borrador", clase: "badge badge-muted" },
  PROGRAMADA: { texto: "Programada", clase: "badge badge-info" },
  ACTIVA: { texto: "Activa", clase: "badge badge-ok" },
  TERMINADA: { texto: "Terminada", clase: "badge badge-muted" },
  REVERTIDA: { texto: "Revertida", clase: "badge badge-warn" },
};

function fecha(valor: string): string {
  return new Date(valor).toLocaleString("es-BO", { timeZone: "America/La_Paz", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function descuentoTexto(c: Campana): string {
  if (c.tipoDescuento === "NINGUNO") return "Solo vitrina";
  return c.tipoDescuento === "PORCENTAJE" ? `−${Number(c.valor)}%` : `−Bs ${Number(c.valor)}`;
}

/**
 * Campañas de descuento masivo (Black Friday, etc.): cada una se programa con inicio y fin, empieza y termina sola y se puede revertir
 * antes de tiempo. Mientras está activa, la tienda muestra su nombre y una cuenta regresiva.
 */
export default function CampanasPage() {
  const [campanas, setCampanas] = useState<Campana[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  // Edición del texto de una campaña (en cualquier estado: no toca precios ni fechas).
  const [editando, setEditando] = useState<Campana | null>(null);
  const [textoNuevo, setTextoNuevo] = useState("");
  const [guardandoTexto, setGuardandoTexto] = useState(false);
  const [errorTexto, setErrorTexto] = useState("");

  async function guardarTexto() {
    if (!editando) return;
    setGuardandoTexto(true);
    setErrorTexto("");
    try {
      await actualizarDescripcionCampana(editando.id, textoNuevo.trim());
      setEditando(null);
      cargar();
    } catch (e) {
      setErrorTexto(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setGuardandoTexto(false);
    }
  }

  const cargar = useCallback(() => {
    getCampanas()
      .then(setCampanas)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(cargar, [cargar]);

  async function accion(c: Campana, que: "programar" | "revertir" | "eliminar") {
    const mensajes = {
      programar: `¿Programar «${c.nombre}»? Empezará sola en su fecha de inicio.`,
      revertir:
        c.estado === "ACTIVA"
          ? `¿Terminar «${c.nombre}» ahora? Los ${c.productos} precios con descuento vuelven a lo que tenían antes.`
          : `¿Cancelar «${c.nombre}»? No llegó a aplicarse.`,
      eliminar: `¿Eliminar el borrador «${c.nombre}»?`,
    };
    if (!confirm(mensajes[que])) return;
    setBusyId(c.id);
    setError("");
    try {
      if (que === "programar") await programarCampana(c.id);
      else if (que === "revertir") await revertirCampana(c.id);
      else await eliminarCampana(c.id);
      cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <div className="ex-head">
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 20 }}>Campañas</h1>
          <p className="cell-muted" style={{ margin: 0, fontSize: 13, maxWidth: 720 }}>
            Descuentos masivos con fecha de inicio y de fin. Empiezan y terminan solos, y al terminar los precios vuelven a lo que tenían. Mientras una
            está activa, la tienda muestra su nombre y la cuenta regresiva.
          </p>
        </div>
        <Link href="/dashboard/campanas/nueva" className="btn-cta">
          <span className="btn-cta-icon">+</span> Nueva campaña
        </Link>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!campanas && !error && <p className="cell-muted">Cargando...</p>}
      {campanas && campanas.length === 0 && (
        <div className="ex-vacio">
          <p>Todavía no hay campañas. Crea la primera con «Nueva campaña».</p>
        </div>
      )}

      {campanas && campanas.length > 0 && (
        <div className="ex-tabla">
          <div className="table-scroll">
            <table className="table table-minimal table-compact">
              <thead>
                <tr>
                  <th>Campaña</th>
                  <th>Estado</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Descuento</th>
                  <th className="num">Productos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {campanas.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-primary">{c.nombre}</td>
                    <td>
                      <span className={ESTADO[c.estado].clase}>{ESTADO[c.estado].texto}</span>
                    </td>
                    <td className="cell-muted">{fecha(c.inicio)}</td>
                    <td className="cell-muted">{fecha(c.fin)}</td>
                    <td>{descuentoTexto(c)}</td>
                    <td className="num">{c.tipoDescuento === "NINGUNO" ? "—" : c.productos}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        {(c.estado === "BORRADOR" || c.estado === "PROGRAMADA" || c.estado === "ACTIVA") && (
                          <button type="button" className="action-btn" onClick={() => { setEditando(c); setTextoNuevo(c.descripcion ?? ""); setErrorTexto(""); }}>
                            Editar texto
                          </button>
                        )}
                        {c.estado === "BORRADOR" && (
                          <>
                            <button type="button" className="action-btn" disabled={busyId === c.id} onClick={() => accion(c, "programar")}>
                              Programar
                            </button>
                            <button type="button" className="action-btn danger" disabled={busyId === c.id} onClick={() => accion(c, "eliminar")}>
                              Eliminar
                            </button>
                          </>
                        )}
                        {(c.estado === "ACTIVA" || c.estado === "PROGRAMADA") && (
                          <button type="button" className="action-btn danger" disabled={busyId === c.id} onClick={() => accion(c, "revertir")}>
                            {c.estado === "ACTIVA" ? "Terminar y revertir" : "Cancelar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editando && (
        <Modal title={`Texto de «${editando.nombre}»`} onClose={() => setEditando(null)} maxWidth={520}>
          <div className="form-grid">
            <p className="cell-muted" style={{ margin: 0, fontSize: 13 }}>
              Es el texto que aparece debajo del nombre en el bloque del inicio y en la portada de la campaña. Se cambia en cualquier momento, aunque ya esté activa. Vacío =
              el texto de siempre.
            </p>
            <textarea className="field" rows={3} maxLength={200} value={textoNuevo} onChange={(e) => setTextoNuevo(e.target.value)} placeholder={DESCRIPCION_CAMPANA_POR_DEFECTO} aria-label="Texto de la campaña" />
            <p className="cell-muted" style={{ fontSize: 12, margin: 0 }}>{textoNuevo.length}/200 · en la tienda se actualiza en menos de un minuto.</p>
            {errorTexto && <p className="error-text">{errorTexto}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button type="button" className="button" disabled={guardandoTexto} onClick={guardarTexto}>
                {guardandoTexto ? "Guardando..." : "Guardar texto"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
