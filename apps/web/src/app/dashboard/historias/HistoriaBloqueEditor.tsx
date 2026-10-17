"use client";

import { useState } from "react";
import {
  API_ORIGIN,
  ApiError,
  removeHistoriaBloqueMobileImage,
  setHistoriaBloqueImage,
  setHistoriaBloqueMobileImage,
  updateHistoriaBloque,
} from "../../../lib/api";
import type { HistoriaBloque } from "../../../lib/types";

function imgSrc(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

function reportError(e: unknown) {
  alert(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
}

export function HistoriaBloqueEditor({
  historiaId,
  bloque,
  titulo,
  esPortada,
  canMoveUp,
  canMoveDown,
  onChanged,
  onRemove,
  onMove,
}: {
  historiaId: string;
  bloque: HistoriaBloque;
  titulo: string;
  esPortada: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChanged: () => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  const [texto1, setTexto1] = useState(bloque.texto1 ?? "");
  const [texto2, setTexto2] = useState(bloque.texto2 ?? "");
  const [texto3, setTexto3] = useState(bloque.texto3 ?? "");
  const [texto4, setTexto4] = useState(bloque.texto4 ?? "");
  const [savingTextos, setSavingTextos] = useState(false);
  const [busyImage, setBusyImage] = useState(false);

  async function handleSaveTextos() {
    setSavingTextos(true);
    try {
      await updateHistoriaBloque(historiaId, bloque.id, { texto1, texto2, texto3, texto4 });
      onChanged();
    } catch (e) {
      reportError(e);
    } finally {
      setSavingTextos(false);
    }
  }

  async function handleSetImage(file: File) {
    setBusyImage(true);
    try {
      await setHistoriaBloqueImage(historiaId, bloque.id, file);
      onChanged();
    } catch (e) {
      reportError(e);
    } finally {
      setBusyImage(false);
    }
  }

  async function handleSetMobileImage(file: File) {
    setBusyImage(true);
    try {
      await setHistoriaBloqueMobileImage(historiaId, bloque.id, file);
      onChanged();
    } catch (e) {
      reportError(e);
    } finally {
      setBusyImage(false);
    }
  }

  async function handleRemoveMobileImage() {
    setBusyImage(true);
    try {
      await removeHistoriaBloqueMobileImage(historiaId, bloque.id);
      onChanged();
    } catch (e) {
      reportError(e);
    } finally {
      setBusyImage(false);
    }
  }

  const desktopSrc = imgSrc(bloque.imageUrl);
  const mobileInputId = `historia-bloque-mobile-${bloque.id}`;
  const desktopInputId = `historia-bloque-desktop-${bloque.id}`;

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <label style={{ fontSize: 14, fontWeight: 600 }}>{titulo}</label>
        {!esPortada && (
          <div className="row-actions">
            <button type="button" className="action-btn" disabled={!canMoveUp} onClick={() => onMove("up")} title="Mover antes">
              ↑
            </button>
            <button type="button" className="action-btn" disabled={!canMoveDown} onClick={() => onMove("down")} title="Mover después">
              ↓
            </button>
            <button type="button" className="action-btn danger" onClick={onRemove} title="Eliminar bloque">
              Eliminar
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 280 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Título</label>
            <input className="field" value={texto1} onChange={(e) => setTexto1(e.target.value)} placeholder="Ej: El hombre detrás de las leyendas" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Nombre destacado (dorado)</label>
            <input className="field" value={texto2} onChange={(e) => setTexto2(e.target.value)} placeholder="Ej: MIZENSIR" />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>Subtítulo (cursiva)</label>
            <input className="field" value={texto3} onChange={(e) => setTexto3(e.target.value)} placeholder="Ej: El lado más personal de un maestro perfumista." />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "var(--muted)" }}>
              Texto / cuerpo{" "}
              <span className="cell-muted">
                (dejá una línea en blanco entre párrafos — rodeá una palabra con **así** para ponerla en negrilla)
              </span>
            </label>
            <textarea className="field" rows={5} value={texto4} onChange={(e) => setTexto4(e.target.value)} />
          </div>
          <button type="button" className="action-btn" disabled={savingTextos} onClick={handleSaveTextos}>
            {savingTextos ? "Guardando..." : "Guardar textos"}
          </button>
        </div>

        <div style={{ flex: "0 0 240px", display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p className="cell-muted" style={{ fontSize: 10, margin: "0 0 2px", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Imagen desktop
            </p>
            <p className="cell-muted" style={{ fontSize: 9.5, margin: "0 0 4px", textAlign: "center" }}>
              Sugerido: 1200×1400px, vertical
            </p>
            {desktopSrc ? (
              <label htmlFor={desktopInputId} className="image-uploader" style={{ padding: 6, justifyContent: "center", cursor: "pointer" }} title="Click para reemplazar">
                <img src={desktopSrc} alt="" />
              </label>
            ) : (
              <label htmlFor={desktopInputId} className="image-uploader-placeholder" style={{ cursor: "pointer", fontSize: 11, textAlign: "center", padding: 8 }}>
                Subir imagen
              </label>
            )}
            <input
              id={desktopInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={busyImage}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSetImage(file);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />
          </div>

          <div style={{ flex: 1 }}>
            <p className="cell-muted" style={{ fontSize: 10, margin: "0 0 2px", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Imagen mobile
            </p>
            <p className="cell-muted" style={{ fontSize: 9.5, margin: "0 0 4px", textAlign: "center" }}>
              Sugerido: 800×600px, horizontal
            </p>
            {bloque.mobileImageUrl ? (
              <div className="image-uploader" style={{ padding: 6, justifyContent: "center", position: "relative" }}>
                <img src={imgSrc(bloque.mobileImageUrl)!} alt="" />
                <button
                  type="button"
                  className="action-btn danger"
                  disabled={busyImage}
                  onClick={handleRemoveMobileImage}
                  title="Quitar imagen mobile (vuelve a usar la de desktop)"
                  style={{ position: "absolute", top: -7, right: -7, width: 18, height: 18, padding: 0, fontSize: 11, lineHeight: 1, borderRadius: "50%" }}
                >
                  ×
                </button>
              </div>
            ) : (
              <label htmlFor={mobileInputId} className="image-uploader-placeholder" style={{ cursor: "pointer", fontSize: 10, textAlign: "center", padding: 8 }} title="Usa la de desktop — click para subir una propia">
                Usa la de desktop
              </label>
            )}
            <input
              id={mobileInputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={busyImage}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSetMobileImage(file);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
