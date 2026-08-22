"use client";

import { useEffect, useState } from "react";
import { API_ORIGIN, apiGet, apiUpload, getLandingImages } from "../../../../lib/api";
import type { Category } from "../../../../lib/types";

function imgSrc(url: string | null): string | null {
  return url ? `${API_ORIGIN}${url}` : null;
}

type Slot =
  | { kind: "category"; id: string; label: string; imageUrl: string | null; hint?: string }
  | { kind: "hero" | "value" | "about"; label: string; imageUrl: string | null; hint?: string };

/**
 * Imágenes usadas en las secciones visuales del home (Producto destacado por categoría raíz,
 * Propuesta de valor, Sobre nosotros) — sin esto, esas secciones muestran un placeholder con
 * degradado (ver .landing-feature-visual / .landing-value-visual / .landing-about-visual).
 */
export default function GridImagenesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [landingImages, setLandingImages] = useState<{
    heroImageUrl: string | null;
    valueImageUrl: string | null;
    aboutImageUrl: string | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  function load() {
    apiGet<Category[]>("/categories")
      .then(setCategories)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getLandingImages()
      .then(setLandingImages)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(load, []);

  async function handleUpload(slotId: string, path: string, file: File) {
    setUploadingId(slotId);
    setError("");
    try {
      await apiUpload(path, file);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingId(null);
    }
  }

  const rootCategories = (categories ?? []).filter((c) => c.parentId === null);

  const slots: Slot[] = [
    {
      kind: "hero" as const,
      label: "Hero principal",
      imageUrl: landingImages?.heroImageUrl ?? null,
      hint: "Recomendado: 2400×1350px o más (relación 16:9), horizontal. Se recorta para cubrir todo el ancho de pantalla (object-fit: cover) — no hay un tamaño exacto que \"entre completa\" porque el hero cambia de alto según el navegador, así que centrá lo importante de la foto: los bordes son lo primero que se recorta en pantallas angostas.",
    },
    ...rootCategories.map((cat) => ({ kind: "category" as const, id: cat.id, label: cat.name, imageUrl: cat.heroImageUrl })),
    { kind: "value" as const, label: "Propuesta de valor", imageUrl: landingImages?.valueImageUrl ?? null },
    { kind: "about" as const, label: "Sobre nosotros", imageUrl: landingImages?.aboutImageUrl ?? null },
  ];

  return (
    <div className="card">
      <h1 style={{ marginTop: 0, fontSize: 20 }}>Grid Imágenes</h1>
      <p className="cell-muted" style={{ marginTop: -8, marginBottom: 20, maxWidth: 640 }}>
        Imágenes de las secciones visuales del home: "Producto destacado" (una por categoría raíz), "Propuesta de
        valor" y "Sobre nosotros". Si una queda sin cargar, esa sección muestra un degradado de relleno en su lugar.
      </p>
      {error && <p className="error-text">{error}</p>}
      {!categories && !error && <p>Cargando...</p>}

      {categories && (
        <div className="grid-3" style={{ gap: 20 }}>
          {slots.map((slot) => {
            const slotId = slot.kind === "category" ? slot.id : slot.kind;
            const uploadPath = slot.kind === "category" ? `/categories/${slot.id}/image` : `/settings/landing-images/${slot.kind}`;
            return (
              <div key={slotId} style={{ border: "1px solid var(--color-divider, var(--line))", borderRadius: 8, padding: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>{slot.label}</label>
                {slot.hint && (
                  <p className="cell-muted" style={{ fontSize: 11.5, margin: "0 0 8px", lineHeight: 1.4 }}>
                    {slot.hint}
                  </p>
                )}
                <div className="image-uploader">
                  {imgSrc(slot.imageUrl) ? (
                    <img src={imgSrc(slot.imageUrl)!} alt={slot.label} />
                  ) : (
                    <div className="image-uploader-placeholder">Sin imagen</div>
                  )}
                  <input
                    className="field"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={uploadingId === slotId}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(slotId, uploadPath, file);
                      e.target.value = "";
                    }}
                    style={{ background: "transparent", border: 0, padding: 0 }}
                  />
                </div>
                {uploadingId === slotId && (
                  <p className="cell-muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Subiendo...
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
