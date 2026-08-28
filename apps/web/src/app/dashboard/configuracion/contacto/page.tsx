"use client";

import { useEffect, useState } from "react";
import { API_ORIGIN, apiDelete, apiGet, apiPost, apiPut, apiUpload, ApiError } from "../../../../lib/api";
import type { ContactoInfo, RedSocial } from "../../../../lib/types";
import { Modal } from "../../../../components/Modal";

function logoSrc(logoUrl: string | null): string | null {
  return logoUrl ? `${API_ORIGIN}${logoUrl}` : null;
}

export default function ContactoPage() {
  const [telefonos, setTelefonos] = useState("");
  const [email, setEmail] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [canalOfertasUrl, setCanalOfertasUrl] = useState("");
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState("");
  const [infoSuccess, setInfoSuccess] = useState(false);

  const [redes, setRedes] = useState<RedSocial[] | null>(null);
  const [redesError, setRedesError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGet<ContactoInfo>("/settings/contacto-info")
      .then((data) => {
        setTelefonos(data.telefonos ?? "");
        setEmail(data.email ?? "");
        setCiudad(data.ciudad ?? "");
        setCanalOfertasUrl(data.canalOfertasUrl ?? "");
      })
      .catch((e) => setInfoError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingInfo(false));
    loadRedes();
  }, []);

  function loadRedes() {
    apiGet<RedSocial[]>("/redes-sociales")
      .then(setRedes)
      .catch((e) => setRedesError(e instanceof Error ? e.message : String(e)));
  }

  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    setInfoError("");
    setInfoSuccess(false);
    setSavingInfo(true);
    try {
      await apiPut("/settings/contacto-info", { telefonos, email, ciudad, canalOfertasUrl });
      setInfoSuccess(true);
      setTimeout(() => setInfoSuccess(false), 4000);
    } catch (e) {
      setInfoError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSavingInfo(false);
    }
  }

  function handleLogoSelect(file: File | null) {
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  function openCreate() {
    setNombre("");
    setUrl("");
    setLogoFile(null);
    setLogoPreview(null);
    setFormError("");
    setModalOpen(true);
  }

  async function handleDelete(red: RedSocial) {
    if (!confirm(`¿Eliminar "${red.nombre}"?`)) return;
    try {
      await apiDelete(`/redes-sociales/${red.id}`);
      loadRedes();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const saved = await apiPost<RedSocial>("/redes-sociales", { nombre, url });
      if (logoFile) {
        await apiUpload(`/redes-sociales/${saved.id}/logo`, logoFile);
      }
      setModalOpen(false);
      loadRedes();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 16px", fontSize: 20 }}>Contacto</h1>
        {loadingInfo ? (
          <p>Cargando...</p>
        ) : (
          <form className="form-grid" onSubmit={handleSaveInfo}>
            <div>
              <label>Números</label>
              <textarea
                className="field"
                value={telefonos}
                onChange={(e) => setTelefonos(e.target.value)}
                placeholder={"Ej: +591 700 00000\n+591 800 00000"}
                rows={3}
              />
            </div>
            <div>
              <label>Correo electrónico</label>
              <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label>Ciudad</label>
              <input className="field" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            </div>
            <div>
              <label>URL del botón "Canal de ofertas" (Newsletter del home)</label>
              <input
                className="field"
                type="url"
                value={canalOfertasUrl}
                onChange={(e) => setCanalOfertasUrl(e.target.value)}
                placeholder="https://chat.whatsapp.com/xxxxx"
              />
            </div>
            {infoError && <p className="error-text">{infoError}</p>}
            <div className="form-actions">
              <button type="submit" className="button" disabled={savingInfo}>
                {savingInfo ? "Guardando..." : "Guardar"}
              </button>
            </div>
            {infoSuccess && <p className="stat-feedback">✓ Datos de contacto actualizados correctamente.</p>}
          </form>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Redes sociales</h2>
          <button type="button" className="btn-cta" onClick={openCreate}>
            <span className="btn-cta-icon">+</span> Nueva red social
          </button>
        </div>

        {redesError && <p className="error-text">{redesError}</p>}
        {!redes && !redesError && <p>Cargando...</p>}
        {redes && redes.length === 0 && <p>No hay redes sociales todavía.</p>}
        {redes && redes.length > 0 && (
          <table className="table table-minimal">
            <thead>
              <tr>
                <th>Logo</th>
                <th>Nombre</th>
                <th>URL</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {redes.map((red) => (
                <tr key={red.id}>
                  <td>
                    {logoSrc(red.logoUrl) ? (
                      <img src={logoSrc(red.logoUrl)!} alt={red.nombre} style={{ width: 32, height: 32, objectFit: "contain" }} />
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                  <td className="cell-primary">{red.nombre}</td>
                  <td>
                    <a href={red.url} target="_blank" rel="noopener noreferrer">
                      {red.url}
                    </a>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="action-btn danger" onClick={() => handleDelete(red)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <Modal title="Nueva red social" onClose={() => setModalOpen(false)}>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div>
              <label>Logo (opcional)</label>
              <div className="image-uploader">
                {logoPreview ? (
                  <img src={logoPreview} alt="Vista previa" />
                ) : (
                  <div className="image-uploader-placeholder">Sin logo</div>
                )}
                <input
                  className="field"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => handleLogoSelect(e.target.files?.[0] ?? null)}
                  style={{ background: "transparent", border: 0, padding: 0 }}
                />
              </div>
            </div>
            <div>
              <label>Nombre</label>
              <input
                className="field"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Instagram"
                required
              />
            </div>
            <div>
              <label>URL</label>
              <input
                className="field"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://instagram.com/tu-cuenta"
                required
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
    </>
  );
}
