"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  createTipoMovimiento,
  getCarteras,
  getTiposMovimientoGlobal,
  updateTipoMovimiento,
} from "../../../../lib/api";
import type { Cartera, NaturalezaMovimiento, TipoMovimientoConCartera } from "../../../../lib/types";
import { Modal } from "../../../../components/Modal";

const COLUMNAS: { naturaleza: NaturalezaMovimiento; titulo: string; singular: string; vacio: string }[] = [
  { naturaleza: "INGRESO", titulo: "Ingresos", singular: "ingreso", vacio: "Esta cartera no tiene tipos de ingreso." },
  { naturaleza: "GASTO", titulo: "Gastos", singular: "gasto", vacio: "Esta cartera no tiene tipos de gasto." },
];

/**
 * Gestión de los tipos de ingreso y gasto, cartera por cartera: no se ve nada hasta elegir una cartera, y entonces sus tipos
 * aparecen separados en dos columnas (Ingresos / Gastos). Crear, desactivar y reactivar se hace desde ahí.
 */
export default function TiposContabilidadPage() {
  const [carteras, setCarteras] = useState<Cartera[] | null>(null);
  const [carteraId, setCarteraId] = useState("");
  const [tipos, setTipos] = useState<TipoMovimientoConCartera[] | null>(null);
  const [verInactivos, setVerInactivos] = useState(false);
  const [error, setError] = useState("");

  const [modalNaturaleza, setModalNaturaleza] = useState<NaturalezaMovimiento | null>(null);
  const [nombre, setNombre] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cartera = carteras?.find((c) => c.id === carteraId) ?? null;

  useEffect(() => {
    getCarteras({ activo: true })
      .then(setCarteras)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)));
  }, []);

  function loadTipos(id: string) {
    getTiposMovimientoGlobal({ carteraId: id })
      .then(setTipos)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    setTipos(null);
    if (carteraId) loadTipos(carteraId);
  }, [carteraId]);

  function openCreate(naturaleza: NaturalezaMovimiento) {
    setModalNaturaleza(naturaleza);
    setNombre("");
    setFormError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!modalNaturaleza || !carteraId) return;
    setFormError("");
    setSubmitting(true);
    try {
      await createTipoMovimiento(carteraId, { nombre: nombre.trim(), naturaleza: modalNaturaleza });
      setModalNaturaleza(null);
      loadTipos(carteraId);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function cambiarEstado(tipo: TipoMovimientoConCartera, activo: boolean) {
    if (!activo && !confirm(`¿Desactivar el tipo "${tipo.nombre}"? Deja de ofrecerse al cargar movimientos; los ya cargados no cambian.`)) return;
    try {
      await updateTipoMovimiento(tipo.id, { activo });
      loadTipos(carteraId);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  const inactivos = (tipos ?? []).filter((t) => !t.activo).length;

  return (
    <div className="card">
      <h1 style={{ margin: "0 0 4px", fontSize: 20 }}>Tipos</h1>
      <p className="cell-muted" style={{ margin: "0 0 16px", fontSize: 13 }}>
        Los tipos de ingreso y de gasto que se pueden elegir al cargar un movimiento. Cada cartera tiene los suyos: elige una para verlos.
      </p>

      <div className="filter-field" style={{ marginBottom: 20 }}>
        <label className="filter-label">Cartera</label>
        {!carteras ? (
          <p className="cell-muted" style={{ margin: 0 }}>Cargando...</p>
        ) : carteras.length === 0 ? (
          <p className="cell-muted" style={{ margin: 0 }}>No hay carteras activas.</p>
        ) : (
          <div className="seg" role="group" aria-label="Cartera" style={{ flexWrap: "wrap", alignSelf: "flex-start" }}>
            {carteras.map((c) => (
              <button key={c.id} type="button" className={c.id === carteraId ? "on" : undefined} onClick={() => setCarteraId(c.id)}>
                {c.nombre} <span style={{ opacity: 0.7, fontWeight: 400 }}>({c.moneda})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {!cartera ? (
        <p className="cell-muted">Elige una cartera para ver y administrar sus tipos.</p>
      ) : !tipos ? (
        <p className="cell-muted">Cargando...</p>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>
              {cartera.nombre} <span className="cell-muted" style={{ fontWeight: 400 }}>· {cartera.moneda}</span>
            </h2>
            {inactivos > 0 && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
                Mostrar inactivos ({inactivos})
              </label>
            )}
          </div>

          <div className="grid-2" style={{ alignItems: "start" }}>
            {COLUMNAS.map((col) => {
              const delTipo = tipos.filter((t) => t.naturaleza === col.naturaleza && (verInactivos || t.activo));
              const activos = tipos.filter((t) => t.naturaleza === col.naturaleza && t.activo).length;
              return (
                <section key={col.naturaleza} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 15 }}>
                      {col.titulo} <span className="cell-muted" style={{ fontWeight: 400 }}>· {activos}</span>
                    </h3>
                    <button type="button" className="action-btn" onClick={() => openCreate(col.naturaleza)}>
                      + Nuevo {col.singular}
                    </button>
                  </div>
                  {delTipo.length === 0 ? (
                    <p className="cell-muted" style={{ margin: 0, fontSize: 13 }}>{col.vacio}</p>
                  ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {delTipo.map((tipo) => (
                        <li
                          key={tipo.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 0",
                            borderTop: "1px solid var(--line)",
                            opacity: tipo.activo ? 1 : 0.55,
                          }}
                        >
                          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                            {tipo.nombre}
                            {!tipo.activo && <span className="badge badge-muted" style={{ marginLeft: 8 }}>Inactivo</span>}
                          </span>
                          {tipo.activo ? (
                            <button type="button" className="action-btn danger" onClick={() => cambiarEstado(tipo, false)}>
                              Desactivar
                            </button>
                          ) : (
                            <button type="button" className="action-btn" onClick={() => cambiarEstado(tipo, true)}>
                              Reactivar
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {modalNaturaleza && cartera && (
        <Modal
          title={`Nuevo ${modalNaturaleza === "INGRESO" ? "ingreso" : "gasto"} · ${cartera.nombre}`}
          onClose={() => setModalNaturaleza(null)}
          maxWidth={420}
        >
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label>Nombre</label>
              <input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
            </div>
            {formError && <p className="error-text">{formError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setModalNaturaleza(null)}>
                Cancelar
              </button>
              <button type="submit" className="button" disabled={submitting}>
                {submitting ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
