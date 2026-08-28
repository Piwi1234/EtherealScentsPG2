"use client";

import { useEffect, useState } from "react";
import { API_ORIGIN, apiDelete, apiGet, apiPost, apiUpload, ApiError } from "../../../../lib/api";
import type { CarritoWhatsappContacto } from "../../../../lib/types";
import { Modal } from "../../../../components/Modal";

function imagenSrc(imagenUrl: string | null): string | null {
  return imagenUrl ? `${API_ORIGIN}${imagenUrl}` : null;
}

export default function CarritoWhatsappPage() {
  const [contactos, setContactos] = useState<CarritoWhatsappContacto[] | null>(null);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadContactos() {
    apiGet<CarritoWhatsappContacto[]>("/carrito-whatsapp")
      .then(setContactos)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(() => {
    loadContactos();
  }, []);

  function handleImagenSelect(file: File | null) {
    if (imagenPreview?.startsWith("blob:")) URL.revokeObjectURL(imagenPreview);
    setImagenFile(file);
    setImagenPreview(file ? URL.createObjectURL(file) : null);
  }

  function openCreate() {
    setNombre("");
    setWhatsapp("");
    setDescripcion("");
    setImagenFile(null);
    setImagenPreview(null);
    setFormError("");
    setModalOpen(true);
  }

  async function handleDelete(contacto: CarritoWhatsappContacto) {
    if (!confirm(`¿Eliminar la ficha de "${contacto.nombre}"?`)) return;
    try {
      await apiDelete(`/carrito-whatsapp/${contacto.id}`);
      loadContactos();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const saved = await apiPost<CarritoWhatsappContacto>("/carrito-whatsapp", {
        nombre,
        whatsapp,
        descripcion: descripcion || undefined,
      });
      if (imagenFile) {
        await apiUpload(`/carrito-whatsapp/${saved.id}/imagen`, imagenFile);
      }
      setModalOpen(false);
      loadContactos();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Carrito Whatsapp</h1>
        <button type="button" className="btn-cta" onClick={openCreate}>
          <span className="btn-cta-icon">+</span> Nueva ficha
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!contactos && !error && <p>Cargando...</p>}
      {contactos && contactos.length === 0 && <p>No hay fichas todavía.</p>}
      {contactos && contactos.length > 0 && (
        <table className="table table-minimal">
          <thead>
            <tr>
              <th>Imagen</th>
              <th>Nombre</th>
              <th>Whatsapp</th>
              <th>Descripción</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contactos.map((contacto) => (
              <tr key={contacto.id}>
                <td>
                  {imagenSrc(contacto.imagenUrl) ? (
                    <img
                      src={imagenSrc(contacto.imagenUrl)!}
                      alt={contacto.nombre}
                      style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <span className="cell-muted">—</span>
                  )}
                </td>
                <td className="cell-primary">{contacto.nombre}</td>
                <td>{contacto.whatsapp}</td>
                <td>{contacto.descripcion || <span className="cell-muted">—</span>}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="action-btn danger" onClick={() => handleDelete(contacto)}>
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <Modal title="Nueva ficha" onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label>Imagen (opcional)</label>
              <div className="image-uploader">
                {imagenPreview ? (
                  <img src={imagenPreview} alt="Vista previa" />
                ) : (
                  <div className="image-uploader-placeholder">Sin imagen</div>
                )}
                <input
                  className="field"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => handleImagenSelect(e.target.files?.[0] ?? null)}
                  style={{ background: "transparent", border: 0, padding: 0 }}
                />
              </div>
            </div>
            <div>
              <label>Nombre</label>
              <input className="field" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div>
              <label>Whatsapp</label>
              <input
                className="field"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Ej: 59167696116"
                required
              />
            </div>
            <div>
              <label>Descripción (opcional)</label>
              <textarea
                className="field"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
              />
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
