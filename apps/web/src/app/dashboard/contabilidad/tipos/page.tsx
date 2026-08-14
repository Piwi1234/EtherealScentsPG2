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

/**
 * Página central de gestión de Tipos de ingreso/gasto — reemplaza la gestión que antes vivía
 * embebida en cada cartera. Acá se ven y crean los tipos de TODAS las carteras a la vez, eligiendo
 * a cuál aplica cada uno en el formulario.
 */
export default function TiposContabilidadPage() {
  const [carteras, setCarteras] = useState<Cartera[]>([]);
  const [tipos, setTipos] = useState<TipoMovimientoConCartera[] | null>(null);
  const [error, setError] = useState("");
  const [filtroCarteraId, setFiltroCarteraId] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [carteraId, setCarteraId] = useState("");
  const [naturaleza, setNaturaleza] = useState<NaturalezaMovimiento>("INGRESO");
  const [nombre, setNombre] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadTipos() {
    getTiposMovimientoGlobal({ carteraId: filtroCarteraId || undefined })
      .then(setTipos)
      .catch((e) => setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    getCarteras({ activo: true }).then(setCarteras);
  }, []);

  useEffect(() => {
    loadTipos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroCarteraId]);

  function openCreate() {
    setCarteraId("");
    setNaturaleza("INGRESO");
    setNombre("");
    setFormError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!carteraId) {
      setFormError("Elegí una cartera.");
      return;
    }
    setSubmitting(true);
    try {
      await createTipoMovimiento(carteraId, { nombre, naturaleza });
      setModalOpen(false);
      loadTipos();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(tipo: TipoMovimientoConCartera) {
    if (!confirm(`¿Desactivar el tipo "${tipo.nombre}" de "${tipo.cartera.nombre}"?`)) return;
    try {
      await updateTipoMovimiento(tipo.id, { activo: false });
      loadTipos();
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
        <h1 style={{ margin: 0, fontSize: 20 }}>Tipos</h1>
        <button type="button" className="btn-cta" onClick={openCreate}>
          <span className="btn-cta-icon">+</span> Nuevo tipo
        </button>
      </div>

      <div className="filters-bar">
        <div>
          <label className="filter-label">Cartera</label>
          <select className="field" value={filtroCarteraId} onChange={(e) => setFiltroCarteraId(e.target.value)}>
            <option value="">Todas las carteras</option>
            {carteras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} ({c.moneda})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!tipos && <p>Cargando...</p>}
      {tipos && tipos.length === 0 && <p>No hay tipos todavía.</p>}
      {tipos && tipos.length > 0 && (
        <table className="table table-minimal">
          <thead>
            <tr>
              <th>Cartera</th>
              <th>Nombre</th>
              <th>Naturaleza</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tipos.map((tipo) => (
              <tr key={tipo.id}>
                <td className="cell-muted">
                  {tipo.cartera.nombre} ({tipo.cartera.moneda})
                </td>
                <td className="cell-primary">{tipo.nombre}</td>
                <td>
                  <span className={`badge ${tipo.naturaleza === "INGRESO" ? "badge-accent" : "badge-muted"}`}>
                    {tipo.naturaleza === "INGRESO" ? "Ingreso" : "Gasto"}
                  </span>
                </td>
                <td>
                  <span className={`badge ${tipo.activo ? "badge-accent" : "badge-muted"}`}>
                    {tipo.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td>
                  {tipo.activo && (
                    <button type="button" className="action-btn danger" onClick={() => handleDeactivate(tipo)}>
                      Desactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <Modal title="Nuevo tipo" onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label>Cartera</label>
              <select className="field" value={carteraId} onChange={(e) => setCarteraId(e.target.value)} required>
                <option value="">— Elegir cartera —</option>
                {carteras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Naturaleza</label>
              <select
                className="field"
                value={naturaleza}
                onChange={(e) => setNaturaleza(e.target.value as NaturalezaMovimiento)}
                required
              >
                <option value="INGRESO">Ingreso</option>
                <option value="GASTO">Gasto</option>
              </select>
            </div>
            <div>
              <label>Nombre</label>
              <input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
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
