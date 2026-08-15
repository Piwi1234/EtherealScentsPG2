"use client";

import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  createProveedor,
  deleteProveedor,
  getPaisesProcedencia,
  getProveedores,
  updateProveedor,
} from "../../../lib/api";
import type { PaisProcedencia, Proveedor, ProveedorInput } from "../../../lib/types";
import { Modal } from "../../../components/Modal";

const EMPTY_FORM: ProveedorInput = { nombre: "", paisProcedenciaId: "", nota: "" };
const DEBOUNCE_MS = 400;

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);
  const [paises, setPaises] = useState<PaisProcedencia[]>([]);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [activo, setActivo] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [form, setForm] = useState<ProveedorInput>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    getProveedores({ pageSize: 100, search: search || undefined, activo: activo || undefined })
      .then((page) => setProveedores(page.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    load();
    getPaisesProcedencia({ pageSize: 100 }).then((page) => setPaises(page.items.filter((p) => p.activo)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activo]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(proveedor: Proveedor) {
    setEditing(proveedor);
    setForm({
      nombre: proveedor.nombre,
      paisProcedenciaId: proveedor.paisProcedenciaId ?? "",
      nota: proveedor.nota ?? "",
      activo: proveedor.activo,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleDeactivate(proveedor: Proveedor) {
    if (!confirm(`¿Desactivar el proveedor "${proveedor.nombre}"?`)) return;
    try {
      await deleteProveedor(proveedor.id);
      load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : String(e));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      if (editing) {
        await updateProveedor(editing.id, form);
      } else {
        await createProveedor(form);
      }
      setModalOpen(false);
      load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Proveedores</h1>
        <button type="button" className="btn-cta" onClick={openCreate}>
          <span className="btn-cta-icon">+</span> Nuevo proveedor
        </button>
      </div>

      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <div className="filter-field">
          <label className="filter-label">Buscar</label>
          <input
            className="field"
            placeholder="Nombre . . ."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-field">
          <label className="filter-label">Estado</label>
          <select className="field" value={activo} onChange={(e) => setActivo(e.target.value)}>
            <option value="">Todos</option>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!proveedores && !error && <p>Cargando...</p>}
      {proveedores && proveedores.length === 0 && (
        <p>{search || activo ? "No hay proveedores para estos filtros." : "No hay proveedores todavía."}</p>
      )}
      {proveedores && proveedores.length > 0 && (
        <table className="table table-minimal">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>País de Procedencia</th>
              <th>Nota</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {proveedores.map((proveedor) => (
              <tr key={proveedor.id}>
                <td className="cell-primary">{proveedor.nombre}</td>
                <td>{proveedor.paisProcedencia?.nombre ?? "—"}</td>
                <td className="cell-muted">{proveedor.nota ?? "—"}</td>
                <td>
                  <span className={`badge ${proveedor.activo ? "badge-accent" : "badge-muted"}`}>
                    {proveedor.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="action-btn" onClick={() => openEdit(proveedor)}>
                      Editar
                    </button>
                    {proveedor.activo && (
                      <button type="button" className="action-btn danger" onClick={() => handleDeactivate(proveedor)}>
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
        <Modal title={editing ? "Editar proveedor" : "Nuevo proveedor"} onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label>Nombre</label>
              <input
                className="field"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </div>
            <div>
              <label>País de Procedencia</label>
              <select
                className="field"
                value={form.paisProcedenciaId}
                onChange={(e) => setForm({ ...form, paisProcedenciaId: e.target.value })}
                required
              >
                <option value="">— Elegir país —</option>
                {paises.map((pais) => (
                  <option key={pais.id} value={pais.id}>
                    {pais.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Nota (opcional)</label>
              <textarea
                className="field"
                rows={3}
                value={form.nota ?? ""}
                onChange={(e) => setForm({ ...form, nota: e.target.value })}
              />
            </div>
            {editing && (
              <div>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.activo ?? true}
                    onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  />
                  Activo
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
