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
  moveHeroCarouselImage,
  moveWeeklyCollectionBannerCarouselImage,
  getPromoModal,
  removeCategoryCarouselImage,
  removeHeroCarouselImage,
  removeHeroCarouselImageMobile,
  removePromoModalImage,
  removeWeeklyCollectionBannerCarouselImage,
  removeWeeklyCollectionBannerCarouselImageMobile,
  setHeroCarouselImageMobile,
  setPromoModalEnabled,
  setPromoModalImage,
  setPromoModalUrl,
  setWeeklyCollectionBannerCarouselImageMobile,
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

// site-hero: el Hero principal del home (categoryId null, singleton). feature: imagen de la tarjeta de cada categoría
// raíz en "Explora por categoría" del home (una sola). weekly-collection-banner: banner de "Colección de la semana"
// del home (categoryId null, singleton).
type SlotKind = "site-hero" | "feature" | "weekly-collection-banner";
type CarouselSlot = { key: string; kind: SlotKind; title: string; hint: string; images: CarouselImage[]; categoryId: string | null };

/**
 * Imágenes usadas en las secciones visuales del home: Hero principal, banner de "Colección de la
 * semana" y la imagen de cada categoría en "Explora por categoría". Si algo queda sin imagen, esa sección muestra un
 * degradado de relleno en su lugar.
 */
export default function GridImagenesPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [heroImages, setHeroImages] = useState<CarouselImage[]>([]);
  const [weeklyCollectionBannerImages, setWeeklyCollectionBannerImages] = useState<CarouselImage[]>([]);
  const [promoModal, setPromoModal] = useState<{ enabled: boolean; imageUrl: string | null; url: string | null } | null>(null);
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
    getPromoModal()
      .then(setPromoModal)
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
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  }

  async function handleTogglePromoModal(enabled: boolean) {
    setBusySlot("promo-modal");
    setError("");
    try {
      await setPromoModalEnabled(enabled);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  }

  async function handleSetPromoModalImage(file: File) {
    setBusySlot("promo-modal");
    setError("");
    try {
      await setPromoModalImage(file);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  }

  async function handleRemovePromoModalImage() {
    setBusySlot("promo-modal");
    setError("");
    try {
      await removePromoModalImage();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusySlot(null);
    }
  }

  async function handleSetPromoModalUrl(url: string | null) {
    setBusySlot("promo-modal");
    setError("");
    try {
      await setPromoModalUrl(url);
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
            />
          ))}

          <CategoryTilesEditor
            categories={rootCategories}
            busySlot={busySlot}
            onSet={(cat, file) => handleAddCarouselImage(`${cat.id}-feature`, "feature", cat.id, file)}
            onRemove={(cat, imageId) => handleRemoveCarouselImage(`${cat.id}-feature`, "feature", cat.id, imageId)}
          />

          {promoModal && (
            <PromoModalEditor
              promoModal={promoModal}
              busy={busySlot === "promo-modal"}
              onToggle={handleTogglePromoModal}
              onSetImage={handleSetPromoModalImage}
              onRemoveImage={handleRemovePromoModalImage}
              onSetUrl={handleSetPromoModalUrl}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Modal promocional del sitio público: aparece con un delay (2,5s) al entrar al sitio, una sola vez
 * por imagen — localStorage guarda cuál fue la última que se vio (ver lib/promo-modal.ts), así que
 * una imagen nueva vuelve a mostrarse sola sin tener que "resetear" nada a mano. enabled en false, o
 * sin imagen cargada, no muestra nada en el sitio aunque esté prendido. */
function PromoModalEditor({
  promoModal,
  busy,
  onToggle,
  onSetImage,
  onRemoveImage,
  onSetUrl,
}: {
  promoModal: { enabled: boolean; imageUrl: string | null; url: string | null };
  busy: boolean;
  onToggle: (enabled: boolean) => void;
  onSetImage: (file: File) => void;
  onRemoveImage: () => void;
  onSetUrl: (url: string | null) => void;
}) {
  const inputId = "promo-modal-image";
  const [urlValue, setUrlValue] = useState(promoModal.url ?? "");

  useEffect(() => {
    setUrlValue(promoModal.url ?? "");
  }, [promoModal.url]);

  function commitUrl() {
    const trimmed = urlValue.trim();
    if (trimmed === (promoModal.url ?? "")) return;
    onSetUrl(trimmed || null);
  }

  return (
    <div style={{ border: "1px solid var(--color-divider, var(--line))", borderRadius: 8, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <label style={{ fontSize: 14, fontWeight: 600 }}>Modal promocional</label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: busy ? "default" : "pointer" }}>
          <input
            type="checkbox"
            checked={promoModal.enabled}
            disabled={busy}
            onChange={(e) => onToggle(e.target.checked)}
          />
          {promoModal.enabled ? "Activado" : "Desactivado"}
        </label>
      </div>
      <p className="cell-muted" style={{ fontSize: 11.5, margin: "0 0 12px", lineHeight: 1.4, maxWidth: 720 }}>
        Aparece centrado sobre el sitio, con un breve retraso después de cargar la página — una sola vez por imagen (si
        subís una nueva, vuelve a mostrarse). Se cierra haciendo click afuera, con la "×" o con Esc. Sin imagen
        cargada, no se muestra nada aunque esté activado. Tamaño sugerido: 1000×1250px o más (vertical, relación
        4:5) — se ajusta para no salirse de la pantalla sin recortarse.
      </p>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ width: 160 }}>
          {promoModal.imageUrl ? (
            <div className="image-uploader" style={{ padding: 6, justifyContent: "center", position: "relative" }}>
              <img src={imgSrc(promoModal.imageUrl)!} alt="Modal promocional" />
              <button
                type="button"
                className="action-btn danger"
                disabled={busy}
                onClick={onRemoveImage}
                aria-label="Quitar imagen"
                title="Quitar imagen"
                style={{ position: "absolute", top: -7, right: -7, width: 18, height: 18, padding: 0, fontSize: 11, lineHeight: 1, borderRadius: "50%" }}
              >
                ×
              </button>
            </div>
          ) : (
            <label
              htmlFor={inputId}
              className="image-uploader-placeholder"
              style={{ cursor: busy ? "default" : "pointer", fontSize: 11, textAlign: "center", padding: 8 }}
            >
              Subir imagen
            </label>
          )}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onSetImage(file);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
          {promoModal.imageUrl && (
            <label
              htmlFor={inputId}
              className="link-button"
              style={{ display: "block", fontSize: 11, marginTop: 4, textAlign: "center", cursor: busy ? "default" : "pointer" }}
            >
              Cambiar
            </label>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          <label className="cell-muted" style={{ fontSize: 11.5, display: "block", marginBottom: 4 }}>
            Link al hacer click (opcional)
          </label>
          <input
            className="field"
            type="url"
            placeholder="URL de redirección (opcional)"
            value={urlValue}
            disabled={busy}
            onChange={(e) => setUrlValue(e.target.value)}
            onBlur={commitUrl}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            style={{ fontSize: 12, padding: "6px 10px", maxWidth: 360 }}
          />
        </div>
      </div>
      {busy && (
        <p className="cell-muted" style={{ fontSize: 12, marginTop: 10 }}>
          Guardando...
        </p>
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
          <div key={image.id} style={{ width: 200 }}>
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

/**
 * Imagen de cada categoría en el bloque "Explora por categoría" del home: una sola por categoría raíz. Subir otra
 * reemplaza la anterior; sin imagen, la tarjeta muestra un degradado azul.
 */
function CategoryTilesEditor({
  categories,
  busySlot,
  onSet,
  onRemove,
}: {
  categories: Category[];
  busySlot: string | null;
  onSet: (category: Category, file: File) => void;
  onRemove: (category: Category, imageId: string) => void;
}) {
  return (
    <div style={{ border: "1px solid var(--color-divider, var(--line))", borderRadius: 8, padding: 14 }}>
      <label style={{ fontSize: 14, fontWeight: 600, display: "block", marginBottom: 4 }}>Explora por categoría</label>
      <p className="cell-muted" style={{ fontSize: 11.5, margin: "0 0 12px", lineHeight: 1.4, maxWidth: 720 }}>
        Una imagen por categoría para su tarjeta en el home (debajo de &quot;Descuento y Ofertas&quot;). El nombre de la categoría y sus
        subcategorías se muestran solos sobre la imagen. Recorte casi cuadrado: 1200×900px o más (relación 4:3); en el celular se
        recorta un poco más a lo ancho (3:2), así que conviene dejar el producto al centro. Si subes otra imagen, reemplaza la anterior.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {categories.map((cat) => {
          const imagen = cat.carouselImages[0] ?? null;
          const busy = busySlot === `${cat.id}-feature`;
          return (
            <div key={cat.id} style={{ width: 240 }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 6px" }}>{cat.name}</p>
              <div className="image-uploader" style={{ padding: 6, justifyContent: "center", position: "relative" }}>
                {imagen ? (
                  <img src={imgSrc(imagen.imageUrl)!} alt={cat.name} style={{ aspectRatio: "4 / 3", objectFit: "cover", width: "100%" }} />
                ) : (
                  <span className="cell-muted" style={{ fontSize: 12, padding: "28px 0" }}>Sin imagen (se usa un degradado)</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                <input
                  className="field"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onSet(cat, file);
                    e.target.value = "";
                  }}
                  style={{ fontSize: 11, padding: "5px 8px", flex: 1, minWidth: 0 }}
                />
                {imagen && (
                  <button type="button" className="action-btn danger" disabled={busy} onClick={() => onRemove(cat, imagen.id)}>
                    Quitar
                  </button>
                )}
              </div>
              {busy && <p className="cell-muted" style={{ fontSize: 11, margin: "4px 0 0" }}>Guardando...</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
