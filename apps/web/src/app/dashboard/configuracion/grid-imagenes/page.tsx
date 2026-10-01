"use client";

import { useEffect, useState } from "react";
import {
  API_ORIGIN,
  addCategoryCarouselImage,
  addHeroCarouselImage,
  addWeeklyCollectionBannerCarouselImage,
  apiGet,
  getHeroCarouselImages,
  getWeeklyCollectionBannerCarouselImages,
  moveCategoryCarouselImage,
  moveHeroCarouselImage,
  moveWeeklyCollectionBannerCarouselImage,
  removeCategoryCarouselImage,
  removeCategoryCarouselImageMobile,
  removeHeroCarouselImage,
  removeHeroCarouselImageMobile,
  removeWeeklyCollectionBannerCarouselImage,
  removeWeeklyCollectionBannerCarouselImageMobile,
  setCategoryCarouselImageMobile,
  setHeroCarouselImageMobile,
  setWeeklyCollectionBannerCarouselImageMobile,
  updateCategoryCarouselImageTitulos,
  updateCategoryCarouselImageUrl,
  updateHeroCarouselImageUrl,
  updateWeeklyCollectionBannerCarouselImageUrl,
} from "../../../../lib/api";
import type { CarouselImage, Category } from "../../../../lib/types";

// Imágenes subidas antes de la migración a R2 tienen url relativo ("/uploads/..."); las nuevas ya
// vienen con la URL pública completa.
function imgSrc(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${API_ORIGIN}${url}`;
}

// site-hero: el Hero principal del home (categoryId null, singleton). feature: bloque "Producto
// destacado" del home, uno por categoría raíz. weekly-collection-banner: banner de "Colección de la
// semana" del home (categoryId null, singleton).
type SlotKind = "site-hero" | "feature" | "weekly-collection-banner";
type CarouselSlot = { key: string; kind: SlotKind; title: string; hint: string; images: CarouselImage[]; categoryId: string | null };

/**
 * Imágenes usadas en las secciones visuales del home: Hero principal, banner de "Colección de la
 * semana" y "Producto destacado" por categoría raíz. Si un carrusel queda sin ninguna imagen, esa
 * sección muestra un degradado de relleno en su lugar.
 */
export default function GridImagenesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [heroImages, setHeroImages] = useState<CarouselImage[]>([]);
  const [weeklyCollectionBannerImages, setWeeklyCollectionBannerImages] = useState<CarouselImage[]>([]);
  const [error, setError] = useState("");
  const [busySlot, setBusySlot] = useState<string | null>(null);

  function load() {
    apiGet<Category[]>("/categories")
      .then(setCategories)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getHeroCarouselImages()
      .then(setHeroImages)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getWeeklyCollectionBannerCarouselImages()
      .then(setWeeklyCollectionBannerImages)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(load, []);

  async function handleAddCarouselImage(slotKey: string, kind: SlotKind, categoryId: string | null, file: File) {
    setBusySlot(slotKey);
    setError("");
    try {
      if (kind === "site-hero") await addHeroCarouselImage(file);
      else if (kind === "weekly-collection-banner") await addWeeklyCollectionBannerCarouselImage(file);
      else await addCategoryCarouselImage(categoryId!, file);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  }

  async function handleRemoveCarouselImage(slotKey: string, kind: SlotKind, categoryId: string | null, imageId: string) {
    setBusySlot(slotKey);
    setError("");
    try {
      if (kind === "site-hero") await removeHeroCarouselImage(imageId);
      else if (kind === "weekly-collection-banner") await removeWeeklyCollectionBannerCarouselImage(imageId);
      else await removeCategoryCarouselImage(categoryId!, imageId);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  }

  async function handleMoveCarouselImage(slotKey: string, kind: SlotKind, categoryId: string | null, imageId: string, direction: "up" | "down") {
    setBusySlot(slotKey);
    setError("");
    try {
      if (kind === "site-hero") await moveHeroCarouselImage(imageId, direction);
      else if (kind === "weekly-collection-banner") await moveWeeklyCollectionBannerCarouselImage(imageId, direction);
      else await moveCategoryCarouselImage(categoryId!, imageId, direction);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  }

  async function handleSetMobileImage(slotKey: string, kind: SlotKind, categoryId: string | null, imageId: string, file: File) {
    setBusySlot(slotKey);
    setError("");
    try {
      if (kind === "site-hero") await setHeroCarouselImageMobile(imageId, file);
      else if (kind === "weekly-collection-banner") await setWeeklyCollectionBannerCarouselImageMobile(imageId, file);
      else await setCategoryCarouselImageMobile(categoryId!, imageId, file);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  }

  async function handleRemoveMobileImage(slotKey: string, kind: SlotKind, categoryId: string | null, imageId: string) {
    setBusySlot(slotKey);
    setError("");
    try {
      if (kind === "site-hero") await removeHeroCarouselImageMobile(imageId);
      else if (kind === "weekly-collection-banner") await removeWeeklyCollectionBannerCarouselImageMobile(imageId);
      else await removeCategoryCarouselImageMobile(categoryId!, imageId);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  }

  async function handleSetCarouselImageUrl(
    slotKey: string,
    kind: SlotKind,
    categoryId: string | null,
    imageId: string,
    url: string | null,
  ) {
    setBusySlot(slotKey);
    setError("");
    try {
      if (kind === "site-hero") await updateHeroCarouselImageUrl(imageId, url);
      else if (kind === "weekly-collection-banner") await updateWeeklyCollectionBannerCarouselImageUrl(imageId, url);
      else await updateCategoryCarouselImageUrl(categoryId!, imageId, url);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  }

  // Solo tiene sentido en el carrusel "feature" (Producto destacado) — es el único slot que le pasa
  // `onSetTitulos` a CarouselSlotEditor, así que no hace falta ramificar por `kind` acá.
  async function handleSetCarouselImageTitulos(
    slotKey: string,
    categoryId: string,
    imageId: string,
    titulo1: string | null,
    titulo2: string | null,
  ) {
    setBusySlot(slotKey);
    setError("");
    try {
      await updateCategoryCarouselImageTitulos(categoryId, imageId, titulo1, titulo2);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  }

  const rootCategories = (categories ?? []).filter((c) => c.parentId === null);

  const homeSlots: CarouselSlot[] = [
    {
      key: "hero",
      kind: "site-hero",
      title: "Hero principal",
      categoryId: null,
      images: heroImages,
      hint:
        "Se muestra 1 sola imagen a pantalla completa por vez — si hay más de una, rotan solas. Cada imagen puede " +
        "llevar su propio link de redirección. PC: 2400×816px o más, panorámica (relación ~2.94:1). Mobile " +
        "(opcional, usa la de PC si no se carga): 1200×900px o más, más compacta (relación 4:3) — el marco cambia " +
        "de forma en pantallas chicas para aprovechar mejor el alto.",
    },
    {
      key: "weekly-collection-banner",
      kind: "weekly-collection-banner",
      title: "Banner de Colección de la semana",
      categoryId: null,
      images: weeklyCollectionBannerImages,
      hint:
        "Banner del bloque \"Colección de la semana\" del home (debajo de \"Descuento y Ofertas\"), arriba de las " +
        "últimas 5 tarjetas de la marca elegida en Marcas — ocupa todo el ancho de esa fila de tarjetas. PC: " +
        "2000×492px o más, panorámica (relación ~4:1), 332px de alto fijo. Mobile (opcional, usa la de PC si no " +
        "se carga): 1000×750px o más, más compacta (relación 4:3) — el marco cambia de forma en pantallas chicas.",
    },
    ...rootCategories.map((cat) => ({
      key: `${cat.id}-feature`,
      kind: "feature" as const,
      title: `${cat.name} — Producto destacado`,
      categoryId: cat.id,
      images: cat.carouselImages,
      hint:
        "Se muestran 3 imágenes lado a lado (recorte vertical) con título superpuesto arriba de cada una " +
        "(Título 1/Título 2) — si no cargás Título 2, se usa el nombre de la categoría. Toda la tarjeta es " +
        "clickeable: va al link propio de la imagen si tiene, si no a la categoría. En mobile se muestra 1 sola a " +
        "la vez (mismo recorte 4:5, no cambia de forma). PC: 850×1050px o más (relación 4:5). Mobile (opcional, " +
        "usa la de PC si no se carga): 680×850px o más (misma relación 4:5), por si querés otro recorte/foco para " +
        "la vista de 1 sola columna.",
    })),
  ];

  return (
    <div className="card">
      <h1 style={{ marginTop: 0, fontSize: 20, marginBottom: 20 }}>Grid Imágenes</h1>
      {error && <p className="error-text">{error}</p>}
      {!categories && !error && <p>Cargando...</p>}

      {categories && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {homeSlots.map((slot) => (
            <CarouselSlotEditor
              key={slot.key}
              title={slot.title}
              hint={slot.hint}
              images={slot.images}
              busy={busySlot === slot.key}
              onAdd={(file) => handleAddCarouselImage(slot.key, slot.kind, slot.categoryId, file)}
              onRemove={(imageId) => handleRemoveCarouselImage(slot.key, slot.kind, slot.categoryId, imageId)}
              onMove={(imageId, direction) => handleMoveCarouselImage(slot.key, slot.kind, slot.categoryId, imageId, direction)}
              onSetUrl={(imageId, url) => handleSetCarouselImageUrl(slot.key, slot.kind, slot.categoryId, imageId, url)}
              onSetMobileImage={(imageId, file) => handleSetMobileImage(slot.key, slot.kind, slot.categoryId, imageId, file)}
              onRemoveMobileImage={(imageId) => handleRemoveMobileImage(slot.key, slot.kind, slot.categoryId, imageId)}
              onSetTitulos={
                slot.kind === "feature"
                  ? (imageId, titulo1, titulo2) =>
                      handleSetCarouselImageTitulos(slot.key, slot.categoryId!, imageId, titulo1, titulo2)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CarouselSlotEditor({
  title,
  hint,
  images,
  busy,
  onAdd,
  onRemove,
  onMove,
  onSetUrl,
  onSetMobileImage,
  onRemoveMobileImage,
  onSetTitulos,
}: {
  title: string;
  hint: string;
  images: CarouselImage[];
  busy: boolean;
  onAdd: (file: File) => void;
  onRemove: (imageId: string) => void;
  onMove: (imageId: string, direction: "up" | "down") => void;
  onSetUrl: (imageId: string, url: string | null) => void;
  onSetMobileImage: (imageId: string, file: File) => void;
  onRemoveMobileImage: (imageId: string) => void;
  // Solo lo pasa el slot "feature" (Producto destacado) — el resto de los carruseles no tiene título
  // superpuesto, así que el bloque de inputs de abajo queda oculto para ellos.
  onSetTitulos?: (imageId: string, titulo1: string | null, titulo2: string | null) => void;
}) {
  return (
    <div style={{ border: "1px solid var(--color-divider, var(--line))", borderRadius: 8, padding: 14 }}>
      <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 4 }}>{title}</label>
      <p className="cell-muted" style={{ fontSize: 11.5, margin: "0 0 12px", lineHeight: 1.4, maxWidth: 720 }}>
        {hint}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12 }}>
        {images.length === 0 && (
          <p className="cell-muted" style={{ fontSize: 12.5, margin: 0 }}>
            Sin imágenes todavía.
          </p>
        )}
        {images.map((image, index) => (
          <div key={image.id} style={{ width: onSetTitulos ? 220 : 200 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="cell-muted" style={{ fontSize: 9.5, margin: "0 0 3px", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  PC
                </p>
                <div className="image-uploader" style={{ padding: 6, justifyContent: "center" }}>
                  <img src={imgSrc(image.imageUrl)!} alt={`${title} ${index + 1} (PC)`} />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="cell-muted" style={{ fontSize: 9.5, margin: "0 0 3px", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Mobile
                </p>
                <MobileImageCell
                  image={image}
                  busy={busy}
                  onSet={(file) => onSetMobileImage(image.id, file)}
                  onRemove={() => onRemoveMobileImage(image.id)}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
              <button
                type="button"
                className="action-btn"
                disabled={busy || index === 0}
                onClick={() => onMove(image.id, "up")}
                aria-label="Mover antes"
                title="Mover antes"
              >
                ↑
              </button>
              <button
                type="button"
                className="action-btn"
                disabled={busy || index === images.length - 1}
                onClick={() => onMove(image.id, "down")}
                aria-label="Mover después"
                title="Mover después"
              >
                ↓
              </button>
              <button
                type="button"
                className="action-btn danger"
                disabled={busy}
                onClick={() => onRemove(image.id)}
                aria-label="Eliminar imagen"
                title="Eliminar imagen"
              >
                ×
              </button>
            </div>
            <CarouselImageUrlInput
              image={image}
              busy={busy}
              onSave={(url) => onSetUrl(image.id, url)}
            />
            {onSetTitulos && (
              <CarouselImageTitulosInput
                image={image}
                busy={busy}
                onSave={(titulo1, titulo2) => onSetTitulos(image.id, titulo1, titulo2)}
              />
            )}
          </div>
        ))}
      </div>

      <input
        className="field"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAdd(file);
          e.target.value = "";
        }}
        style={{ maxWidth: 320 }}
      />
      {busy && (
        <p className="cell-muted" style={{ fontSize: 12, marginTop: 6 }}>
          Guardando...
        </p>
      )}
    </div>
  );
}

/** Columna "Mobile" de una imagen del grid — si no tiene variante mobile cargada todavía, muestra un
 * placeholder clickeable ("Usa la de PC") que al clickear abre el selector de archivo; si ya tiene
 * una, la previsualiza con una "×" chica para sacarla (vuelve a usar la de PC) y un link "Cambiar"
 * debajo para reemplazarla. */
function MobileImageCell({
  image,
  busy,
  onSet,
  onRemove,
}: {
  image: CarouselImage;
  busy: boolean;
  onSet: (file: File) => void;
  onRemove: () => void;
}) {
  const inputId = `mobile-image-${image.id}`;

  return (
    <>
      {image.mobileImageUrl ? (
        <div className="image-uploader" style={{ padding: 6, justifyContent: "center", position: "relative" }}>
          <img src={imgSrc(image.mobileImageUrl)!} alt="Variante mobile" />
          <button
            type="button"
            className="action-btn danger"
            disabled={busy}
            onClick={onRemove}
            aria-label="Quitar imagen mobile"
            title="Quitar imagen mobile (vuelve a usar la de PC)"
            style={{ position: "absolute", top: -7, right: -7, width: 18, height: 18, padding: 0, fontSize: 11, lineHeight: 1, borderRadius: "50%" }}
          >
            ×
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="image-uploader-placeholder"
          title="Usa la de PC — click para subir una propia"
          style={{ cursor: busy ? "default" : "pointer", fontSize: 9, lineHeight: 1.25, padding: 4, textAlign: "center" }}
        >
          Usa la de PC
        </label>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSet(file);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
      {image.mobileImageUrl && (
        <label
          htmlFor={inputId}
          className="link-button"
          style={{ display: "block", fontSize: 9.5, marginTop: 3, textAlign: "center", cursor: busy ? "default" : "pointer" }}
        >
          Cambiar
        </label>
      )}
    </>
  );
}

/** Link opcional al que redirige la imagen en el sitio público al hacer click — se guarda al salir
 * del campo (blur) o con Enter, solo si cambió. Vacío = sin click, como era antes de este campo. */
function CarouselImageUrlInput({
  image,
  busy,
  onSave,
}: {
  image: CarouselImage;
  busy: boolean;
  onSave: (url: string | null) => void;
}) {
  const [value, setValue] = useState(image.url ?? "");

  useEffect(() => {
    setValue(image.url ?? "");
  }, [image.url]);

  function commit() {
    const trimmed = value.trim();
    if (trimmed === (image.url ?? "")) return;
    onSave(trimmed || null);
  }

  return (
    <input
      className="field"
      type="url"
      placeholder="URL de redirección (opcional)"
      value={value}
      disabled={busy}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      style={{ fontSize: 11, padding: "5px 8px", marginTop: 2 }}
    />
  );
}

/** Texto superpuesto sobre la imagen en el bloque "Producto destacado" del home — titulo1 (chico,
 * arriba) y titulo2 (grande, debajo). Mismo mecanismo que la URL: se guarda al salir del campo o con
 * Enter, solo si cambió. Vacío = no se muestra esa línea. */
function CarouselImageTitulosInput({
  image,
  busy,
  onSave,
}: {
  image: CarouselImage;
  busy: boolean;
  onSave: (titulo1: string | null, titulo2: string | null) => void;
}) {
  const [titulo1, setTitulo1] = useState(image.titulo1 ?? "");
  const [titulo2, setTitulo2] = useState(image.titulo2 ?? "");

  useEffect(() => {
    setTitulo1(image.titulo1 ?? "");
    setTitulo2(image.titulo2 ?? "");
  }, [image.titulo1, image.titulo2]);

  function commit() {
    const trimmed1 = titulo1.trim();
    const trimmed2 = titulo2.trim();
    if (trimmed1 === (image.titulo1 ?? "") && trimmed2 === (image.titulo2 ?? "")) return;
    onSave(trimmed1 || null, trimmed2 || null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <>
      <input
        className="field"
        type="text"
        placeholder="Título 1 (subtítulo chico, opcional)"
        value={titulo1}
        disabled={busy}
        onChange={(e) => setTitulo1(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        style={{ fontSize: 11, padding: "5px 8px", marginTop: 4 }}
      />
      <input
        className="field"
        type="text"
        placeholder="Título 2 (título grande, opcional)"
        value={titulo2}
        disabled={busy}
        onChange={(e) => setTitulo2(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        style={{ fontSize: 11, padding: "5px 8px", marginTop: 4 }}
      />
    </>
  );
}
