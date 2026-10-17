"use client";

import { useState } from "react";
import { API_ORIGIN, ApiError, removeHistoriaHomeMobileImage, setHistoriaHomeImage, setHistoriaHomeMobileImage } from "../../../lib/api";
import type { HistoriaDetalle } from "../../../lib/types";

function imgSrc(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

function reportError(e: unknown) {
  alert(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
}

/** Imagen propia del bloque "Última historia" del home — independiente de la imagen de la portada
 * (bloques[0]): esa se ve bien angosta y alta en /historias/[slug], pero este bloque del home es
 * panorámico (~980x460), así que una misma foto no queda bien recortada en los dos lugares a la
 * vez. Sin cargar nada acá, el home sigue cayendo a la imagen de la portada, como antes. */
export function HistoriaHomeImageEditor({ historia, onChanged }: { historia: HistoriaDetalle; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function handleSetImage(file: File) {
    setBusy(true);
    try {
      await setHistoriaHomeImage(historia.id, file);
      onChanged();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleSetMobileImage(file: File) {
    setBusy(true);
    try {
      await setHistoriaHomeMobileImage(historia.id, file);
      onChanged();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveMobileImage() {
    setBusy(true);
    try {
      await removeHistoriaHomeMobileImage(historia.id);
      onChanged();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }

  const desktopSrc = imgSrc(historia.homeImageUrl);
  const desktopInputId = `historia-home-desktop-${historia.id}`;
  const mobileInputId = `historia-home-mobile-${historia.id}`;

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>Imagen del bloque del Home</h2>
      <p className="cell-muted" style={{ fontSize: 12, margin: "0 0 16px" }}>
        Opcional — sin cargar nada acá, el bloque "Última historia" del home usa la imagen de la
        página principal. Este recorte es panorámico (distinto al de la portada), así que conviene
        una foto propia para que no se vea mal recortada en el home.
      </p>

      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ flex: "0 0 240px" }}>
          <p className="cell-muted" style={{ fontSize: 10, margin: "0 0 2px", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Imagen desktop
          </p>
          <p className="cell-muted" style={{ fontSize: 9.5, margin: "0 0 4px", textAlign: "center" }}>
            Sugerido: 1200×1150px, casi cuadrada
          </p>
          {desktopSrc ? (
            <label htmlFor={desktopInputId} className="image-uploader" style={{ padding: 6, justifyContent: "center", cursor: "pointer" }} title="Click para reemplazar">
              <img src={desktopSrc} alt="" />
            </label>
          ) : (
            <label htmlFor={desktopInputId} className="image-uploader-placeholder" style={{ cursor: "pointer", fontSize: 11, textAlign: "center", padding: 8 }}>
              Subir imagen (opcional — usa la de la portada si no cargás nada)
            </label>
          )}
          <input
            id={desktopInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleSetImage(file);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </div>

        <div style={{ flex: "0 0 240px" }}>
          <p className="cell-muted" style={{ fontSize: 10, margin: "0 0 2px", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Imagen mobile
          </p>
          <p className="cell-muted" style={{ fontSize: 9.5, margin: "0 0 4px", textAlign: "center" }}>
            Sugerido: 800×600px, horizontal
          </p>
          {historia.homeMobileImageUrl ? (
            <div className="image-uploader" style={{ padding: 6, justifyContent: "center", position: "relative" }}>
              <img src={imgSrc(historia.homeMobileImageUrl)!} alt="" />
              <button
                type="button"
                className="action-btn danger"
                disabled={busy}
                onClick={handleRemoveMobileImage}
                title="Quitar imagen mobile"
                style={{ position: "absolute", top: -7, right: -7, width: 18, height: 18, padding: 0, fontSize: 11, lineHeight: 1, borderRadius: "50%" }}
              >
                ×
              </button>
            </div>
          ) : (
            <label htmlFor={mobileInputId} className="image-uploader-placeholder" style={{ cursor: "pointer", fontSize: 10, textAlign: "center", padding: 8 }}>
              {desktopSrc ? "Usa la de desktop" : "Usa la de la portada"}
            </label>
          )}
          <input
            id={mobileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={busy}
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
  );
}
