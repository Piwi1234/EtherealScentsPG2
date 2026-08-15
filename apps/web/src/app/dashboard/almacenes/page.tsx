"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  createAlmacen,
  createCiudad,
  createPaisProcedencia,
  deactivatePaisProcedencia,
  deleteAlmacen,
  deleteCiudad,
  getAlmacenes,
  getCiudades,
  getPaisesProcedencia,
  updateAlmacen,
} from "../../../lib/api";
import type { Almacen, Ciudad, PaisProcedencia } from "../../../lib/types";
import { Modal } from "../../../components/Modal";

export default function AlmacenesPage() {
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [error, setError] = useState("");

  const [ciudadNombre, setCiudadNombre] = useState("");
  const [ciudadSubmitting, setCiudadSubmitting] = useState(false);

  const [paisesProcedencia, setPaisesProcedencia] = useState<PaisProcedencia[]>([]);
  const [paisProcedenciaNombre, setPaisProcedenciaNombre] = useState("");
  const [paisProcedenciaSubmitting, setPaisProcedenciaSubmitting] = useState(false);

  const [almacenModalOpen, setAlmacenModalOpen] = useState(false);
  const [editingAlmacen, setEditingAlmacen] = useState<Almacen | null>(null);
  const [almacenNombre, setAlmacenNombre] = useState("");
  const [almacenActivo, setAlmacenActivo] = useState(true);
  const [almacenFormError, setAlmacenFormError] = useState("");
  const [almacenSubmitting, setAlmacenSubmitting] = useState(false);

  function loadCiudades() {
    return getCiudades({ pageSize: 100 }).then((page) => setCiudades(page.items));
  }

  function loadPaisesProcedencia() {
    return getPaisesProcedencia({ pageSize: 100 }).then((page) => setPaisesProcedencia(page.items));
  }

  function loadAlmacenes() {
    return getAlmacenes({ pageSize: 200 }).then((page) => setAlmacenes(page.items));
  }

  useEffect(() => {
    Promise.all([loadCiudades(), loadPaisesProcedencia(), loadAlmacenes()]).catch((e) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, []);

  async function handleCreateCiudad(e: React.FormEvent) {
    e.preventDefault();
    if (!ciudadNombre.trim()) return;
    setCiudadSubmitting(true);
    try {
      await createCiudad(ciudadNombre.trim());
      setCiudadNombre("");
      await loadCiudades();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    } finally {
      setCiudadSubmitting(false);
    }
  }

  async function handleCreatePaisProcedencia(e: React.FormEvent) {
    e.preventDefault();
    if (!paisProcedenciaNombre.trim()) return;
    setPaisProcedenciaSubmitting(true);
    try {
      await createPaisProcedencia(paisProcedenciaNombre.trim());
      setPaisProcedenciaNombre("");
      await loadPaisesProcedencia();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    } finally {
      setPaisProcedenciaSubmitting(false);
    }
  }

  async function handleDeactivatePaisProcedencia(pais: PaisProcedencia) {
    if (!confirm(`¿Desactivar el país de procedencia "${pais.nombre}"?`)) return;
    try {
      await deactivatePaisProcedencia(pais.id);
      await loadPaisesProcedencia();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  function openCreateAlmacen() {
    setEditingAlmacen(null);
    setAlmacenNombre("");
    setAlmacenActivo(true);
    setAlmacenFormError("");
    setAlmacenModalOpen(true);
  }

  function openEditAlmacen(almacen: Almacen) {
    setEditingAlmacen(almacen);
    setAlmacenNombre(almacen.nombre);
    setAlmacenActivo(almacen.activo);
    setAlmacenFormError("");
    setAlmacenModalOpen(true);
  }

  async function handleSubmitAlmacen(e: React.FormEvent) {
    e.preventDefault();
    setAlmacenFormError("");
    setAlmacenSubmitting(true);
    try {
      if (editingAlmacen) {
        await updateAlmacen(editingAlmacen.id, { nombre: almacenNombre, activo: almacenActivo });
      } else {
        await createAlmacen({ nombre: almacenNombre });
      }
      setAlmacenModalOpen(false);
      await loadAlmacenes();
    } catch (e) {
      setAlmacenFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setAlmacenSubmitting(false);
    }
  }

  async function handleDeactivateAlmacen(almacen: Almacen) {
    if (!confirm(`¿Desactivar el almacén "${almacen.nombre}"?`)) return;
    try {
      await deleteAlmacen(almacen.id);
      await loadAlmacenes();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function handleDeleteCiudad(ciudad: Ciudad) {
    if (!confirm(`¿Eliminar la ciudad "${ciudad.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteCiudad(ciudad.id);
      await loadCiudades();
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Almacenes</h1>
          <button type="button" className="btn-cta" onClick={openCreateAlmacen}>
            <span className="btn-cta-icon">+</span> Nuevo almacén
          </button>
        </div>
        {almacenes.length === 0 ? (
          <p>No hay almacenes todavía.</p>
        ) : (
          <table className="table table-minimal">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {almacenes.map((almacen) => (
                <tr key={almacen.id}>
                  <td className="cell-primary">{almacen.nombre}</td>
                  <td>
                    <span className={`badge ${almacen.activo ? "badge-accent" : "badge-muted"}`}>
                      {almacen.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="action-btn" onClick={() => openEditAlmacen(almacen)}>
                        Editar
                      </button>
                      {almacen.activo && (
                        <button type="button" className="action-btn danger" onClick={() => handleDeactivateAlmacen(almacen)}>
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
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Ciudades</h2>
        {ciudades.length === 0 ? (
          <p className="cell-muted" style={{ marginBottom: 12 }}>
            Ninguna todavía.
          </p>
        ) : (
          <table className="table table-minimal" style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ciudades.map((ciudad) => (
                <tr key={ciudad.id}>
                  <td className="cell-primary">{ciudad.nombre}</td>
                  <td>
                    <span className={`badge ${ciudad.activo ? "badge-accent" : "badge-muted"}`}>
                      {ciudad.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="action-btn danger" onClick={() => handleDeleteCiudad(ciudad)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={handleCreateCiudad} style={{ display: "flex", gap: 8 }}>
          <input
            className="field"
            placeholder="Nombre de la ciudad"
            value={ciudadNombre}
            onChange={(e) => setCiudadNombre(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button type="submit" className="action-btn" disabled={ciudadSubmitting}>
            {ciudadSubmitting ? "Agregando..." : "Agregar ciudad"}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Países de Procedencia</h2>
        <p className="cell-muted" style={{ marginTop: -8, marginBottom: 12 }}>
          De dónde viene la mercadería — todavía sin uso, se conecta a algo más adelante.
        </p>
        {paisesProcedencia.length === 0 ? (
          <p className="cell-muted" style={{ marginBottom: 12 }}>
            Ninguno todavía.
          </p>
        ) : (
          <table className="table table-minimal" style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paisesProcedencia.map((pais) => (
                <tr key={pais.id}>
                  <td className="cell-primary">{pais.nombre}</td>
                  <td>
                    <span className={`badge ${pais.activo ? "badge-accent" : "badge-muted"}`}>
                      {pais.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      {pais.activo && (
                        <button
                          type="button"
                          className="action-btn danger"
                          onClick={() => handleDeactivatePaisProcedencia(pais)}
                        >
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
        <form onSubmit={handleCreatePaisProcedencia} style={{ display: "flex", gap: 8 }}>
          <input
            className="field"
            placeholder="Nombre del país"
            value={paisProcedenciaNombre}
            onChange={(e) => setPaisProcedenciaNombre(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button type="submit" className="action-btn" disabled={paisProcedenciaSubmitting}>
            {paisProcedenciaSubmitting ? "Agregando..." : "Agregar país"}
          </button>
        </form>
      </div>

      {almacenModalOpen && (
        <Modal title={editingAlmacen ? "Editar almacén" : "Nuevo almacén"} onClose={() => setAlmacenModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmitAlmacen}>
            <div>
              <label>Nombre</label>
              <input className="field" value={almacenNombre} onChange={(e) => setAlmacenNombre(e.target.value)} required />
            </div>
            {editingAlmacen && (
              <div>
                <label className="checkbox-row">
                  <input type="checkbox" checked={almacenActivo} onChange={(e) => setAlmacenActivo(e.target.checked)} />
                  Activo
                </label>
              </div>
            )}
            {almacenFormError && <p className="error-text">{almacenFormError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setAlmacenModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="button" disabled={almacenSubmitting}>
                {almacenSubmitting ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
