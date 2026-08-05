"use client";

import { useEffect, useState } from "react";
import {
  ApiError,
  createAlmacen,
  createCiudad,
  createZonaCobertura,
  deleteAlmacen,
  deleteZonaCobertura,
  getAlmacenes,
  getCiudades,
  getZonasCobertura,
  updateAlmacen,
  updateZonaCobertura,
} from "../../../lib/api";
import type { Almacen, Ciudad, ZonaCobertura } from "../../../lib/types";
import { Modal } from "../../../components/Modal";

export default function AlmacenesPage() {
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [zonas, setZonas] = useState<ZonaCobertura[]>([]);
  const [error, setError] = useState("");

  const [ciudadNombre, setCiudadNombre] = useState("");
  const [ciudadSubmitting, setCiudadSubmitting] = useState(false);

  const [almacenModalOpen, setAlmacenModalOpen] = useState(false);
  const [editingAlmacen, setEditingAlmacen] = useState<Almacen | null>(null);
  const [almacenNombre, setAlmacenNombre] = useState("");
  const [almacenCiudadId, setAlmacenCiudadId] = useState("");
  const [almacenActivo, setAlmacenActivo] = useState(true);
  const [almacenFormError, setAlmacenFormError] = useState("");
  const [almacenSubmitting, setAlmacenSubmitting] = useState(false);

  const [zonaCiudadId, setZonaCiudadId] = useState("");
  const [zonaAlmacenId, setZonaAlmacenId] = useState("");
  const [zonaPrioridad, setZonaPrioridad] = useState(1);
  const [zonaFiltroCiudadId, setZonaFiltroCiudadId] = useState("");
  const [zonaFormError, setZonaFormError] = useState("");
  const [zonaSubmitting, setZonaSubmitting] = useState(false);

  function loadCiudades() {
    return getCiudades({ pageSize: 100 }).then((page) => setCiudades(page.items));
  }

  function loadAlmacenes() {
    return getAlmacenes({ pageSize: 200 }).then((page) => setAlmacenes(page.items));
  }

  function loadZonas(ciudadId?: string) {
    return getZonasCobertura(ciudadId || undefined).then(setZonas);
  }

  useEffect(() => {
    Promise.all([loadCiudades(), loadAlmacenes(), loadZonas()]).catch((e) =>
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

  function openCreateAlmacen() {
    setEditingAlmacen(null);
    setAlmacenNombre("");
    setAlmacenCiudadId(ciudades[0]?.id ?? "");
    setAlmacenActivo(true);
    setAlmacenFormError("");
    setAlmacenModalOpen(true);
  }

  function openEditAlmacen(almacen: Almacen) {
    setEditingAlmacen(almacen);
    setAlmacenNombre(almacen.nombre);
    setAlmacenCiudadId(almacen.ciudadId);
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
        await updateAlmacen(editingAlmacen.id, { nombre: almacenNombre, ciudadId: almacenCiudadId, activo: almacenActivo });
      } else {
        await createAlmacen({ nombre: almacenNombre, ciudadId: almacenCiudadId });
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

  async function handleCreateZona(e: React.FormEvent) {
    e.preventDefault();
    setZonaFormError("");
    if (!zonaCiudadId || !zonaAlmacenId) {
      setZonaFormError("Elegí una ciudad y un almacén.");
      return;
    }
    setZonaSubmitting(true);
    try {
      await createZonaCobertura({ ciudadId: zonaCiudadId, almacenId: zonaAlmacenId, prioridad: zonaPrioridad });
      setZonaAlmacenId("");
      setZonaPrioridad(1);
      await loadZonas(zonaFiltroCiudadId);
    } catch (e) {
      setZonaFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setZonaSubmitting(false);
    }
  }

  async function handleUpdatePrioridad(zona: ZonaCobertura, prioridad: number) {
    try {
      await updateZonaCobertura(zona.ciudadId, zona.almacenId, prioridad);
      await loadZonas(zonaFiltroCiudadId);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function handleDeleteZona(zona: ZonaCobertura) {
    if (!confirm(`¿Quitar "${zona.almacen.nombre}" de la cobertura de "${zona.ciudad.nombre}"?`)) return;
    try {
      await deleteZonaCobertura(zona.ciudadId, zona.almacenId);
      await loadZonas(zonaFiltroCiudadId);
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
          <button type="button" className="btn-cta" onClick={openCreateAlmacen} disabled={ciudades.length === 0}>
            <span className="btn-cta-icon">+</span> Nuevo almacén
          </button>
        </div>
        {ciudades.length === 0 && <p className="cell-muted">Primero creá al menos una ciudad más abajo.</p>}
        {almacenes.length === 0 ? (
          <p>No hay almacenes todavía.</p>
        ) : (
          <table className="table table-minimal">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Ciudad</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {almacenes.map((almacen) => (
                <tr key={almacen.id}>
                  <td className="cell-primary">{almacen.nombre}</td>
                  <td>{almacen.ciudad.nombre}</td>
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
        <div className="filters-bar" style={{ marginBottom: 12 }}>
          {ciudades.map((c) => (
            <span key={c.id} className="badge">
              {c.nombre}
            </span>
          ))}
          {ciudades.length === 0 && <span className="cell-muted">Ninguna todavía.</span>}
        </div>
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
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Zonas de cobertura</h2>
        <p className="cell-muted" style={{ marginBottom: 12 }}>
          Define, para cada ciudad, qué almacenes pueden abastecerla y con qué prioridad (1 = primera opción) al
          repartir el stock de una venta.
        </p>

        <div className="filter-field" style={{ marginBottom: 12, maxWidth: 260 }}>
          <label className="filter-label">Filtrar por ciudad</label>
          <select
            className="field"
            value={zonaFiltroCiudadId}
            onChange={(e) => {
              setZonaFiltroCiudadId(e.target.value);
              loadZonas(e.target.value);
            }}
          >
            <option value="">Todas</option>
            {ciudades.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {zonas.length === 0 ? (
          <p className="cell-muted">No hay zonas de cobertura configuradas.</p>
        ) : (
          <table className="table table-minimal" style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Ciudad</th>
                <th>Almacén</th>
                <th className="num">Prioridad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {zonas
                .slice()
                .sort((a, b) => a.ciudad.nombre.localeCompare(b.ciudad.nombre) || a.prioridad - b.prioridad)
                .map((zona) => (
                  <tr key={`${zona.ciudadId}-${zona.almacenId}`}>
                    <td>{zona.ciudad.nombre}</td>
                    <td className="cell-primary">{zona.almacen.nombre}</td>
                    <td className="num">
                      <input
                        className="field"
                        type="number"
                        min={1}
                        defaultValue={zona.prioridad}
                        onBlur={(e) => {
                          const value = parseInt(e.target.value, 10);
                          if (!Number.isNaN(value) && value !== zona.prioridad) handleUpdatePrioridad(zona, value);
                        }}
                        style={{ width: 60, textAlign: "center" }}
                      />
                    </td>
                    <td className="num">
                      <button type="button" className="action-btn danger" onClick={() => handleDeleteZona(zona)}>
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        <form onSubmit={handleCreateZona} className="filters-bar">
          <div className="filter-field">
            <label className="filter-label">Ciudad</label>
            <select className="field" value={zonaCiudadId} onChange={(e) => setZonaCiudadId(e.target.value)}>
              <option value="">— Elegir —</option>
              {ciudades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label className="filter-label">Almacén</label>
            <select className="field" value={zonaAlmacenId} onChange={(e) => setZonaAlmacenId(e.target.value)}>
              <option value="">— Elegir —</option>
              {almacenes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.ciudad.nombre})
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <label className="filter-label">Prioridad</label>
            <input
              className="field"
              type="number"
              min={1}
              value={zonaPrioridad}
              onChange={(e) => setZonaPrioridad(parseInt(e.target.value, 10) || 1)}
              style={{ width: 80 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className="action-btn" disabled={zonaSubmitting}>
              {zonaSubmitting ? "Agregando..." : "Agregar zona"}
            </button>
          </div>
        </form>
        {zonaFormError && <p className="error-text" style={{ marginTop: 8 }}>{zonaFormError}</p>}
      </div>

      {almacenModalOpen && (
        <Modal title={editingAlmacen ? "Editar almacén" : "Nuevo almacén"} onClose={() => setAlmacenModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmitAlmacen}>
            <div>
              <label>Nombre</label>
              <input className="field" value={almacenNombre} onChange={(e) => setAlmacenNombre(e.target.value)} required />
            </div>
            <div>
              <label>Ciudad</label>
              <select className="field" value={almacenCiudadId} onChange={(e) => setAlmacenCiudadId(e.target.value)} required>
                <option value="">— Elegir —</option>
                {ciudades.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
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
