"use client";

import { useEffect, useState } from "react";
import { ApiError, createEmpresa, deleteEmpresa, getEmpresas, updateEmpresa } from "../../../lib/api";
import type { Empresa, EmpresaInput, TipoEmpresa } from "../../../lib/types";
import { Modal } from "../../../components/Modal";

const TIPO_LABELS: Record<TipoEmpresa, string> = {
  CASA_MATRIZ: "Casa matriz",
  SUCURSAL: "Sucursal",
};

const EMPTY_FORM: EmpresaInput = { nombre: "", tipo: "SUCURSAL", razonSocial: "", nit: "", logoUrl: "" };

export default function EmpresasPage() {
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm] = useState<EmpresaInput>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    getEmpresas({ pageSize: 100 })
      .then((page) => setEmpresas(page.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(empresa: Empresa) {
    setEditing(empresa);
    setForm({
      nombre: empresa.nombre,
      tipo: empresa.tipo,
      razonSocial: empresa.razonSocial,
      nit: empresa.nit,
      logoUrl: empresa.logoUrl ?? "",
      activo: empresa.activo,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleDeactivate(empresa: Empresa) {
    if (!confirm(`¿Desactivar la empresa "${empresa.nombre}"?`)) return;
    try {
      await deleteEmpresa(empresa.id);
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
      const payload = { ...form, logoUrl: form.logoUrl || undefined };
      if (editing) {
        await updateEmpresa(editing.id, payload);
      } else {
        await createEmpresa(payload);
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
        <h1 style={{ margin: 0, fontSize: 20 }}>Empresas</h1>
        <button type="button" className="btn-cta" onClick={openCreate}>
          <span className="btn-cta-icon">+</span> Nueva empresa
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {!empresas && !error && <p>Cargando...</p>}
      {empresas && empresas.length === 0 && <p>No hay empresas todavía.</p>}
      {empresas && empresas.length > 0 && (
        <table className="table table-minimal">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Razón social</th>
              <th>NIT</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {empresas.map((empresa) => (
              <tr key={empresa.id}>
                <td className="cell-primary">{empresa.nombre}</td>
                <td>{TIPO_LABELS[empresa.tipo]}</td>
                <td>{empresa.razonSocial}</td>
                <td className="cell-code">{empresa.nit}</td>
                <td>
                  <span className={`badge ${empresa.activo ? "badge-accent" : "badge-muted"}`}>
                    {empresa.activo ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="action-btn" onClick={() => openEdit(empresa)}>
                      Editar
                    </button>
                    {empresa.activo && (
                      <button type="button" className="action-btn danger" onClick={() => handleDeactivate(empresa)}>
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
        <Modal title={editing ? "Editar empresa" : "Nueva empresa"} onClose={() => setModalOpen(false)}>
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
              <label>Tipo</label>
              <select
                className="field"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoEmpresa })}
              >
                <option value="CASA_MATRIZ">Casa matriz</option>
                <option value="SUCURSAL">Sucursal</option>
              </select>
            </div>
            <div>
              <label>Razón social</label>
              <input
                className="field"
                value={form.razonSocial}
                onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                required
              />
            </div>
            <div>
              <label>NIT</label>
              <input className="field" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} required />
            </div>
            <div>
              <label>Logo (URL, opcional)</label>
              <input
                className="field"
                value={form.logoUrl ?? ""}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
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
