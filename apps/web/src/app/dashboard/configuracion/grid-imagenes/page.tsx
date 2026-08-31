"use client";

import { useEffect, useState } from "react";
import {
  API_ORIGIN,
  addCategoryCarouselImage,
  addCategoryHeroCarouselImage,
  addHeroCarouselImage,
  addMarcasHeroCarouselImage,
  addOffersBannerCarouselImage,
  addWeeklyCollectionBannerCarouselImage,
  apiGet,
  apiUpload,
  getHeroCarouselImages,
  getLandingImages,
  getMarcasHeroCarouselImages,
  getOffersBannerCarouselImages,
  getWeeklyCollectionBannerCarouselImages,
  moveCategoryCarouselImage,
  moveCategoryHeroCarouselImage,
  moveHeroCarouselImage,
  moveMarcasHeroCarouselImage,
  moveOffersBannerCarouselImage,
  moveWeeklyCollectionBannerCarouselImage,
  removeCategoryCarouselImage,
  removeCategoryHeroCarouselImage,
  removeHeroCarouselImage,
  removeMarcasHeroCarouselImage,
  removeOffersBannerCarouselImage,
  removeWeeklyCollectionBannerCarouselImage,
  updateCategoryCarouselImageTitulos,
  updateCategoryCarouselImageUrl,
  updateCategoryHeroCarouselImageUrl,
  updateHeroCarouselImageUrl,
  updateMarcasHeroCarouselImageUrl,
  updateOffersBannerCarouselImageUrl,
  updateWeeklyCollectionBannerCarouselImageUrl,
} from "../../../../lib/api";
import type { CarouselImage, Category } from "../../../../lib/types";

function imgSrc(url: string | null): string | null {
  return url ? `${API_ORIGIN}${url}` : null;
}

// site-hero: el Hero principal del home (categoryId null, singleton). feature: bloque "Producto
// destacado" del home, uno por categoría raíz. category-hero: hero de /categoria/[slug], también uno
// por categoría raíz pero un carrusel independiente del de feature (otro tamaño, otro propósito) —
// compartido con todas las subcategorías de esa raíz, que no tienen uno propio. marcas-hero: hero de
// /marcas (categoryId null, singleton, independiente del Hero principal del home). offers-banner:
// banner de imágenes del home (categoryId null, singleton) que ocupa el 5to lugar de la fila de
// "Descuento y Ofertas", mismo tamaño que una tarjeta de producto.
type SlotKind = "site-hero" | "feature" | "category-hero" | "marcas-hero" | "offers-banner" | "weekly-collection-banner";
type CarouselSlot = { key: string; kind: SlotKind; title: string; hint: string; images: CarouselImage[]; categoryId: string | null };

/**
 * Imágenes usadas en las secciones visuales del sitio, organizadas en dos bloques: "Home" (Hero
 * principal, banners de "Descuento y Ofertas"/"Colección de la semana", "Producto destacado" por
 * categoría raíz, y las imágenes únicas de "Propuesta de valor"/"Sobre nosotros") y "Hero de
 * categorías y marcas" (hero de /marcas y hero de /categoria/[slug] por categoría raíz, compartido con
 * sus subcategorías). Si un carrusel queda sin ninguna imagen, esa sección muestra un degradado de
 * relleno en su lugar.
 */
export default function GridImagenesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [heroImages, setHeroImages] = useState<CarouselImage[]>([]);
  const [marcasHeroImages, setMarcasHeroImages] = useState<CarouselImage[]>([]);
  const [offersBannerImages, setOffersBannerImages] = useState<CarouselImage[]>([]);
  const [weeklyCollectionBannerImages, setWeeklyCollectionBannerImages] = useState<CarouselImage[]>([]);
  const [landingImages, setLandingImages] = useState<{ valueImageUrl: string | null; aboutImageUrl: string | null } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [busySlot, setBusySlot] = useState<string | null>(null);

  function load() {
    apiGet<Category[]>("/categories")
      .then(setCategories)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getHeroCarouselImages()
      .then(setHeroImages)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getMarcasHeroCarouselImages()
      .then(setMarcasHeroImages)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getOffersBannerCarouselImages()
      .then(setOffersBannerImages)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getWeeklyCollectionBannerCarouselImages()
      .then(setWeeklyCollectionBannerImages)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getLandingImages()
      .then(setLandingImages)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }

  useEffect(load, []);

  async function handleAddCarouselImage(slotKey: string, kind: SlotKind, categoryId: string | null, file: File) {
    setBusySlot(slotKey);
    setError("");
    try {
      if (kind === "site-hero") await addHeroCarouselImage(file);
      else if (kind === "marcas-hero") await addMarcasHeroCarouselImage(file);
      else if (kind === "offers-banner") await addOffersBannerCarouselImage(file);
      else if (kind === "weekly-collection-banner") await addWeeklyCollectionBannerCarouselImage(file);
      else if (kind === "feature") await addCategoryCarouselImage(categoryId!, file);
      else await addCategoryHeroCarouselImage(categoryId!, file);
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
      else if (kind === "marcas-hero") await removeMarcasHeroCarouselImage(imageId);
      else if (kind === "offers-banner") await removeOffersBannerCarouselImage(imageId);
      else if (kind === "weekly-collection-banner") await removeWeeklyCollectionBannerCarouselImage(imageId);
      else if (kind === "feature") await removeCategoryCarouselImage(categoryId!, imageId);
      else await removeCategoryHeroCarouselImage(categoryId!, imageId);
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
      else if (kind === "marcas-hero") await moveMarcasHeroCarouselImage(imageId, direction);
      else if (kind === "offers-banner") await moveOffersBannerCarouselImage(imageId, direction);
      else if (kind === "weekly-collection-banner") await moveWeeklyCollectionBannerCarouselImage(imageId, direction);
      else if (kind === "feature") await moveCategoryCarouselImage(categoryId!, imageId, direction);
      else await moveCategoryHeroCarouselImage(categoryId!, imageId, direction);
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
      else if (kind === "marcas-hero") await updateMarcasHeroCarouselImageUrl(imageId, url);
      else if (kind === "offers-banner") await updateOffersBannerCarouselImageUrl(imageId, url);
      else if (kind === "weekly-collection-banner") await updateWeeklyCollectionBannerCarouselImageUrl(imageId, url);
      else if (kind === "feature") await updateCategoryCarouselImageUrl(categoryId!, imageId, url);
      else await updateCategoryHeroCarouselImageUrl(categoryId!, imageId, url);
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

  async function handleUploadSingle(slotId: string, path: string, file: File) {
    setBusySlot(slotId);
    setError("");
    try {
      await apiUpload(path, file);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  }

  const rootCategories = (categories ?? []).filter((c) => c.parentId === null);

  // Bloque "Home": todo lo que se ve en la página de inicio.
  const homeSlots: CarouselSlot[] = [
    {
      key: "hero",
      kind: "site-hero",
      title: "Hero principal",
      categoryId: null,
      images: heroImages,
      hint:
        "Se muestran de a 3 banners lado a lado (como en agatres.co) — si hay más de 3 imágenes, rotan solas de a " +
        "grupos de 3. Cada imagen puede llevar su propio link de redirección (no comparten uno solo). Recomendado: " +
        "1200×1360px o más, vertical (relación 3:3.4), por cada imagen.",
    },
    {
      key: "offers-banner",
      kind: "offers-banner",
      title: "Banner de Ofertas",
      categoryId: null,
      images: offersBannerImages,
      hint:
        "Ocupa el 5to lugar de la fila de \"Descuento y Ofertas\" del home, junto a las 4 tarjetas de producto — " +
        "mismo tamaño que ellas (~267×450px en pantallas grandes). Recomendado: 550×900px o más, vertical " +
        "(relación ~3:5), por cada imagen del carrusel.",
    },
    {
      key: "weekly-collection-banner",
      kind: "weekly-collection-banner",
      title: "Banner de Colección de la semana",
      categoryId: null,
      images: weeklyCollectionBannerImages,
      hint:
        "Banner del bloque \"Colección de la semana\" del home (debajo de \"Descuento y Ofertas\"), junto a las 8 " +
        "tarjetas de los últimos productos de la marca elegida en Marcas — mismo tamaño que esa columna " +
        "(504×664px fijo en pantallas grandes, más grande que el banner de Ofertas). Recomendado: 1000×1320px o " +
        "más, vertical (relación ~3:4), por cada imagen del carrusel.",
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
        "clickeable: va al link propio de la imagen si tiene, si no a la categoría. Recomendado: 850×1050px o " +
        "más (relación 4:5) por cada imagen — se recorta para llenar el cuadro (object-fit: cover), dejá lugar " +
        "arriba para el texto.",
    })),
  ];

  // Bloque "Hero de categorías y marcas": los heros panorámicos de /categoria/[slug] y /marcas —
  // independientes de los carruseles del home de arriba.
  const heroSlots: CarouselSlot[] = [
    {
      key: "marcas-hero",
      kind: "marcas-hero",
      title: "Hero de Marcas",
      categoryId: null,
      images: marcasHeroImages,
      hint:
        "Fondo del hero de la página /marcas — carrusel independiente del Hero principal del home. Recomendado: " +
        "2400×600px o más (relación ~4:1, muy panorámico). El alto de este banner lo da el padding + el texto, " +
        "unos 300–450px según el dispositivo, así que una imagen muy ancha y baja cubre mejor que una alta.",
    },
    ...rootCategories.map((cat) => ({
      key: `${cat.id}-hero`,
      kind: "category-hero" as const,
      title: `${cat.name} — Hero de categoría`,
      categoryId: cat.id,
      images: cat.heroCarouselImages,
      hint:
        "Se usa como fondo del hero de la página de esta categoría y de todas sus subcategorías — carrusel " +
        "independiente del de \"Producto destacado\" del home. Recomendado: 2400×600px o más (relación ~4:1, muy " +
        "panorámico) — el alto de este banner lo da el padding + el texto, unos 300–450px según el dispositivo, " +
        "así que conviene una imagen muy ancha y baja, no alta.",
    })),
  ];

  return (
    <div className="card">
      <h1 style={{ marginTop: 0, fontSize: 20, marginBottom: 20 }}>Grid Imágenes</h1>
      {error && <p className="error-text">{error}</p>}
      {!categories && !error && <p>Cargando...</p>}

      {categories && (
        <>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Home</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 20 }}>
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
                onSetTitulos={
                  slot.kind === "feature"
                    ? (imageId, titulo1, titulo2) =>
                        handleSetCarouselImageTitulos(slot.key, slot.categoryId!, imageId, titulo1, titulo2)
                    : undefined
                }
              />
            ))}
          </div>

          <div className="grid-3" style={{ gap: 20, marginBottom: 28 }}>
            {(
              [
                {
                  id: "value",
                  label: "Propuesta de valor",
                  imageUrl: landingImages?.valueImageUrl ?? null,
                  hint: "Recomendado: 1600×1100px o más (relación 16:11).",
                },
                {
                  id: "about",
                  label: "Sobre nosotros",
                  imageUrl: landingImages?.aboutImageUrl ?? null,
                  hint: "Recomendado: 1600×1000px o más, horizontal (relación 8:5).",
                },
              ] as const
            ).map((slot) => (
              <div key={slot.id} style={{ border: "1px solid var(--color-divider, var(--line))", borderRadius: 8, padding: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>{slot.label}</label>
                <p className="cell-muted" style={{ fontSize: 11.5, margin: "0 0 8px", lineHeight: 1.4 }}>{slot.hint}</p>
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
                    disabled={busySlot === slot.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadSingle(slot.id, `/settings/landing-images/${slot.id}`, file);
                      e.target.value = "";
                    }}
                    style={{ background: "transparent", border: 0, padding: 0 }}
                  />
                </div>
                {busySlot === slot.id && (
                  <p className="cell-muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Subiendo...
                  </p>
                )}
              </div>
            ))}
          </div>

          <div style={{ background: "#080706", borderRadius: 12, padding: 20 }}>
            <h2 style={{ fontSize: 16, marginBottom: 12, marginTop: 0, color: "#efefef" }}>Hero de categorías y marcas</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {heroSlots.map((slot) => (
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
                />
              ))}
            </div>
          </div>
        </>
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

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        {images.length === 0 && (
          <p className="cell-muted" style={{ fontSize: 12.5, margin: 0 }}>
            Sin imágenes todavía.
          </p>
        )}
        {images.map((image, index) => (
          <div key={image.id} style={{ width: onSetTitulos ? 160 : 140 }}>
            <div className="image-uploader" style={{ marginBottom: 6 }}>
              <img src={`${API_ORIGIN}${image.imageUrl}`} alt={`${title} ${index + 1}`} />
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
