"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../../../lib/api";
import type { Page, Rol, Usuario } from "../../../lib/types";
import { getAuthUser } from "../../../lib/auth";
import { Modal } from "../../../components/Modal";

const ROL_LABELS: Record<Rol, string> = { ADMIN: "Administrador", SELLER: "Vendedor" };

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });
}

export default function UsersPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<Rol>("SELLER");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const self = getAuthUser();
    if (self?.rol !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [router]);

  function loadUsuarios() {
    apiGet<Page<Usuario>>("/usuarios?pageSize=100")
      .then((page) => setUsuarios(page.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(loadUsuarios, []);

  function openCreate() {
    setEditing(null);
    setNombre("");
    setEmail("");
    setPassword("");
    setRol("SELLER");
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(usuario: Usuario) {
    setEditing(usuario);
    setNombre(usuario.nombre);
    setEmail(usuario.email);
    setPassword("");
    setRol(usuario.rol);
    setFormError("");
    setModalOpen(true);
  }

  async function toggleActivo(usuario: Usuario) {
    const accion = usuario.activo ? "desactivar" : "activar";
    if (!confirm(`¿${accion === "desactivar" ? "Desactivar" : "Activar"} a "${usuario.nombre}"?`)) return;
    try {
      if (usuario.activo) {
        await apiDelete(`/usuarios/${usuario.id}`);
      } else {
        await apiPatch(`/usuarios/${usuario.id}`, { activo: true });
      }
      loadUsuarios();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      if (editing) {
        const payload: Record<string, unknown> = { nombre, email, rol };
        if (password) payload.password = password;
        await apiPatch(`/usuarios/${editing.id}`, payload);
      } else {
        await apiPost("/usuarios", { nombre, email, password, rol });
      }
      setModalOpen(false);
      loadUsuarios();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Roles y permisos</h1>
        <button type="button" className="btn-cta" onClick={openCreate}>
          <span className="btn-cta-icon">+</span> Nuevo usuario
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {!usuarios && !error && <p>Cargando...</p>}
      {usuarios && usuarios.length === 0 && <p>No hay usuarios todavía.</p>}
      {usuarios && usuarios.length > 0 && (
        <table className="table table-minimal">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Último login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td className="cell-primary">{usuario.nombre}</td>
                <td className="cell-muted">{usuario.email}</td>
                <td><span className="badge">{ROL_LABELS[usuario.rol]}</span></td>
                <td>
                  <span className={`badge${usuario.activo ? "" : " badge-muted"}`}>
                    {usuario.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="cell-muted">{formatDate(usuario.ultimoLogin)}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="action-btn" onClick={() => openEdit(usuario)}>Editar</button>
                    <button
                      type="button"
                      className={`action-btn${usuario.activo ? " danger" : ""}`}
                      onClick={() => toggleActivo(usuario)}
                    >
                      {usuario.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <Modal title={editing ? "Editar usuario" : "Nuevo usuario"} onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label>Nombre</label>
              <input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div>
              <label>Email</label>
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label>{editing ? "Nueva contraseña" : "Contraseña"}</label>
              <input
                className="field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editing ? "Dejar en blanco para no cambiarla" : undefined}
                minLength={8}
                required={!editing}
              />
            </div>
            <div>
              <label>Rol</label>
              <select className="field" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
                <option value="ADMIN">Administrador</option>
                <option value="SELLER">Vendedor</option>
              </select>
            </div>
            {formError && <p className="error-text">{formError}</p>}
            <div className="form-actions">
              <button type="button" className="link-button" onClick={() => setModalOpen(false)}>Cancelar</button>
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
