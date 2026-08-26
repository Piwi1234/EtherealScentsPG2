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
// destacado" del home, uno por categoría raíz. category-hero: hero de /categoria/[id], también uno
// por categoría raíz pero un carrusel independiente del de feature (otro tamaño, otro propósito) —
// compartido con todas las subcategorías de esa raíz, que no tienen uno propio. marcas-hero: hero de
// /marcas (categoryId null, singleton, independiente del Hero principal del home). offers-banner:
// banner de imágenes del home (categoryId null, singleton) que ocupa el 5to lugar de la fila de
// "Descuento y Ofertas", mismo tamaño que una tarjeta de producto.
type SlotKind = "site-hero" | "feature" | "category-hero" | "marcas-hero" | "offers-banner" | "weekly-collection-banner";
type CarouselSlot = { key: string; kind: SlotKind; title: string; hint: string; images: CarouselImage[]; categoryId: string | null };

/**
 * Imágenes usadas en las secciones visuales del sitio: el carrusel del Hero, el del banner de
 * "Descuento y Ofertas", el del hero de /marcas, dos carruseles independientes por categoría raíz
 * ("Producto destacado" del home y el hero de su propia página, este último compartido con sus
 * subcategorías), y las imágenes únicas de "Propuesta de valor"/"Sobre nosotros". Si un carrusel
 * queda sin ninguna imagen, esa sección muestra un degradado de relleno en su lugar.
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

  const carouselSlots: CarouselSlot[] = [
    {
      key: "hero",
      kind: "site-hero",
      title: "Hero principal",
      categoryId: null,
      images: heroImages,
      hint:
        "Recomendado: 2400×1350px o más (relación 16:9), horizontal, por cada imagen del carrusel. Se recorta para " +
        "cubrir todo el ancho de pantalla (object-fit: cover) — no hay un tamaño exacto que \"entre completa\" " +
        "porque el hero cambia de alto según el navegador, así que centrá lo importante de la foto: los bordes son " +
        "lo primero que se recorta en pantallas angostas.",
    },
    {
      key: "offers-banner",
      kind: "offers-banner",
      title: "Banner de Ofertas",
      categoryId: null,
      images: offersBannerImages,
      hint:
        "Ocupa el 5to lugar de la fila de \"Descuento y Ofertas\" del home, junto a las 4 tarjetas de producto — " +
        "mismo tamaño que ellas. Recomendado: 800×1000px o más, vertical (relación 4:5), por cada imagen del " +
        "carrusel.",
    },
    {
      key: "weekly-collection-banner",
      kind: "weekly-collection-banner",
      title: "Banner de Colección de la semana",
      categoryId: null,
      images: weeklyCollectionBannerImages,
      hint:
        "Banner del bloque \"Colección de la semana\" del home (debajo de \"Descuento y Ofertas\"), junto a las 12 " +
        "tarjetas de los últimos productos de la marca elegida en Marcas — mismo tamaño que una tarjeta de " +
        "producto. Recomendado: 800×1000px o más, vertical (relación 4:5), por cada imagen del carrusel.",
    },
    {
      key: "marcas-hero",
      kind: "marcas-hero",
      title: "Hero de Marcas",
      categoryId: null,
      images: marcasHeroImages,
      hint:
        "Fondo del hero de la página /marcas — carrusel independiente del Hero principal de arriba. Recomendado: " +
        "2400×1500px o más, horizontal (este hero es 10% más alto que el Hero principal), por cada imagen del " +
        "carrusel.",
    },
    ...rootCategories.flatMap((cat) => [
      {
        key: `${cat.id}-feature`,
        kind: "feature" as const,
        title: `${cat.name} — Producto destacado`,
        categoryId: cat.id,
        images: cat.carouselImages,
        hint:
          "Se usa en el bloque \"Producto destacado\" del home. Recomendado: 1200×1200px o más, cuadrada (relación " +
          "1:1) — se recorta para llenar el cuadro (object-fit: cover), centrá lo importante de la foto.",
      },
      {
        key: `${cat.id}-hero`,
        kind: "category-hero" as const,
        title: `${cat.name} — Hero de categoría`,
        categoryId: cat.id,
        images: cat.heroCarouselImages,
        hint:
          "Se usa como fondo del hero de la página de esta categoría y de todas sus subcategorías (recorte " +
          "panorámico, 10% más alto que el Hero principal) — carrusel independiente del de \"Producto destacado\" " +
          "de arriba, no uno por subcategoría. Recomendado: 2400×1500px o más, horizontal.",
      },
    ]),
  ];

  return (
    <div className="card">
      <h1 style={{ marginTop: 0, fontSize: 20 }}>Grid Imágenes</h1>
      <p className="cell-muted" style={{ marginTop: -8, marginBottom: 20, maxWidth: 700 }}>
        Imágenes de las secciones visuales del sitio: el carrusel del Hero, el del banner de "Descuento y Ofertas",
        el del hero de /marcas, y por cada categoría raíz dos carruseles independientes — "Producto destacado" del
        home y el hero de su propia página (compartido con todas sus subcategorías) — más las imágenes únicas de
        "Propuesta de valor"/"Sobre nosotros". Un carrusel sin ninguna imagen cargada muestra un degradado de
        relleno en su lugar. Cada imagen de un carrusel puede tener un link opcional: si lo carga, esa imagen queda
        clickeable en el sitio público y redirige ahí; si lo deja vacío, queda decorativa (sin click), como antes.
      </p>
      {error && <p className="error-text">{error}</p>}
      {!categories && !error && <p>Cargando...</p>}

      {categories && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 28 }}>
            {carouselSlots.map((slot) => (
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

          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Imágenes únicas</h2>
          <div className="grid-3" style={{ gap: 20 }}>
            {(
              [
                { id: "value", label: "Propuesta de valor", imageUrl: landingImages?.valueImageUrl ?? null },
                { id: "about", label: "Sobre nosotros", imageUrl: landingImages?.aboutImageUrl ?? null },
              ] as const
            ).map((slot) => (
              <div key={slot.id} style={{ border: "1px solid var(--color-divider, var(--line))", borderRadius: 8, padding: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>{slot.label}</label>
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
}: {
  title: string;
  hint: string;
  images: CarouselImage[];
  busy: boolean;
  onAdd: (file: File) => void;
  onRemove: (imageId: string) => void;
  onMove: (imageId: string, direction: "up" | "down") => void;
  onSetUrl: (imageId: string, url: string | null) => void;
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
          <div key={image.id} style={{ width: 140 }}>
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
