"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, createCartera, deactivateCartera, getCarteras, updateCartera } from "../../lib/api";
import type { Cartera, MonedaCartera } from "../../lib/types";
import { formatMonto } from "../../lib/moneda";
import { Modal } from "../Modal";

/**
 * Listado de carteras de UNA moneda — las 5 páginas "Cuenta X" del sidebar renderizan esto mismo
 * parametrizado por `moneda`, para no repetir la lógica 5 veces.
 */
export function CarterasList({ moneda, titulo }: { moneda: MonedaCartera; titulo: string }) {
  const [carteras, setCarteras] = useState<Cartera[] | null>(null);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cartera | null>(null);
  const [nombre, setNombre] = useState("");
  const [activo, setActivo] = useState(true);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    getCarteras({ moneda })
      .then(setCarteras)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(load, [moneda]);

  function openCreate() {
    setEditing(null);
    setNombre("");
    setActivo(true);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(cartera: Cartera) {
    setEditing(cartera);
    setNombre(cartera.nombre);
    setActivo(cartera.activo);
    setFormError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      if (editing) {
        await updateCartera(editing.id, { nombre, activo });
      } else {
        await createCartera({ moneda, nombre });
      }
      setModalOpen(false);
      load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(cartera: Cartera) {
    if (!confirm(`¿Desactivar la cartera "${cartera.nombre}"? El historial de movimientos queda intacto.`)) return;
    try {
      await deactivateCartera(cartera.id);
      load();
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

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>{titulo}</h1>
        <button type="button" className="btn-cta" onClick={openCreate}>
          <span className="btn-cta-icon">+</span> Nueva cartera
        </button>
      </div>
      {!carteras && <p>Cargando...</p>}
      {carteras && carteras.length === 0 && <p>No hay carteras todavía.</p>}
      {carteras && carteras.length > 0 && (
        <table className="table table-minimal">
          <thead>
            <tr>
              <th>Nombre</th>
              <th className="num">Saldo actual</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {carteras.map((cartera) => (
              <tr key={cartera.id}>
                <td className="cell-primary">
                  <Link href={`/dashboard/contabilidad/carteras/${cartera.id}`} className="link-button">
                    {cartera.nombre}
                  </Link>
                </td>
                <td className="num">{formatMonto(cartera.saldoActual, moneda)}</td>
                <td>
                  <span className={`badge ${cartera.activo ? "badge-accent" : "badge-muted"}`}>
                    {cartera.activo ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="action-btn" onClick={() => openEdit(cartera)}>
                      Editar
                    </button>
                    {cartera.activo && (
                      <button type="button" className="action-btn danger" onClick={() => handleDeactivate(cartera)}>
                        Desactivar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <Modal title={editing ? "Editar cartera" : "Nueva cartera"} onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label>Nombre</label>
              <input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            {editing && (
              <div>
                <label className="checkbox-row">
                  <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                  Activa
                </label>
              </div>
            )}
            {formError && <p className="error-text">{formError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setModalOpen(false)}>
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
