"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, getBrands, getCasaMatrizLogo, getLandingImages } from "../../lib/api";
import { brandLinkHref, productImageSrc } from "../../lib/catalog-display";
import type { Brand, CarouselImage, Category, ContactoInfo, Page, Product } from "../../lib/types";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { ImageCarousel } from "../../components/landing/ImageCarousel";
import { ProductCard } from "../../components/landing/ProductCard";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const OFFERS_SLIDE_SIZE = 5;
const OFFERS_SLIDE_SIZE_MOBILE = 2;
const OFFERS_AUTOPLAY_MS = 7000;
const BRANDS_SLIDE_SIZE = 8;
const BRANDS_AUTOPLAY_MS = 10000;
const HERO_AUTOPLAY_MS = 10000;
// Mismo breakpoint que usa el navbar para pasar a mobile — abajo de esto el carrusel de ofertas
// pagina de a 2 (en vez de 5). El hero ya muestra 1 sola imagen a cualquier ancho (ver heroWindow).
const MOBILE_BREAKPOINT = "(max-width: 768px)";
const FEATURE_AUTOPLAY_MS = 10000;
const WEEKLY_COLLECTION_BANNER_AUTOPLAY_MS = 10000;
const WEEKLY_COLLECTION_SIZE = 5;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export default function HomePage() {
  // --- Datos: empresa (nombre para textos propios), categorías reales y productos del catálogo público ---
  const [empresa, setEmpresa] = useState<{ nombre: string | null } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [flashOnly, setFlashOnly] = useState(false);
  // null = todavía no se sabe si hay ofertas flash vigentes (se está consultando al montar). Hasta
  // que se resuelva, el pill "Ofertas Flash" queda oculto y el fetch de productos de abajo espera —
  // así arranca directo en el filtro correcto sin parpadeo.
  const [hasFlashOffers, setHasFlashOffers] = useState<boolean | null>(null);
  const [productsPage, setProductsPage] = useState<Page<Product> | null>(null);
  const [offersSlide, setOffersSlide] = useState(0);
  const [offersAutoKey, setOffersAutoKey] = useState(0);
  const [offersDirection, setOffersDirection] = useState<1 | -1>(1);
  const [isMobile, setIsMobile] = useState(false);
  const [landingImages, setLandingImages] = useState<{
    heroImages: CarouselImage[];
    weeklyCollectionBannerImages: CarouselImage[];
    weeklyCollectionBrand: { id: string; name: string; slug: string; logoUrl: string | null } | null;
  } | null>(null);
  const [weeklyCollectionProducts, setWeeklyCollectionProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [contacto, setContacto] = useState<ContactoInfo | null>(null);

  const rootCategories = categories.filter((cat) => cat.parentId === null);

  // Arranca en la primera categoría (según su orden real, ver category.service.ts) apenas cargan —
  // antes había un pill "Todas" que se sacó a pedido, ahora el filtro de categoría de este bloque
  // siempre apunta a una puntual.
  useEffect(() => {
    if (categoryFilter || rootCategories.length === 0) return;
    setCategoryFilter(rootCategories[0].id);
  }, [rootCategories, categoryFilter]);

  useEffect(() => {
    getCasaMatrizLogo().then(setEmpresa).catch(() => {});
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    getBrands().then(setBrands).catch(() => {});
    getLandingImages().then(setLandingImages).catch(() => {});
    apiGet<ContactoInfo>("/settings/contacto-info").then(setContacto).catch(() => {});

    // Si hay ofertas flash vigentes, ese pill arranca seleccionado por defecto.
    apiGet<Page<Product>>("/catalog/products?onlyFlash=true&pageSize=1")
      .then((page) => {
        const has = page.total > 0;
        setHasFlashOffers(has);
        setFlashOnly(has);
      })
      .catch(() => setHasFlashOffers(false));
  }, []);

  // Carrusel de "Descuento y Ofertas": últimos 40 productos con descuento (por fecha de última
  // modificación) de la categoría elegida, de 5 en 5. Modo (1ra fila) y categoría (2da fila) se
  // combinan siempre — "Ofertas Flash" ya no es exclusivo de todas las categorías juntas, también se
  // puede acotar a una.
  useEffect(() => {
    // Esperar a saber si hay ofertas flash (ver arriba) y a que se resuelva la categoría por defecto
    // (ver el efecto de arriba) antes de disparar el fetch real — si no, arrancaría sin categoría y a
    // los pocos ms saltaría a la primera, con doble fetch y salto visual.
    if (hasFlashOffers === null || !categoryFilter) return;

    const params = new URLSearchParams();
    if (flashOnly) params.set("onlyFlash", "true");
    else params.set("onlyDiscounted", "true");
    params.set("categoryId", categoryFilter);
    params.set("pageSize", "40");
    params.set("sortBy", "actualizados");
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then((page) => {
        setProductsPage(page);
        setOffersSlide(0);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [categoryFilter, flashOnly, hasFlashOffers]);

  // En mobile pagina de a 2 productos en vez de 5 (ver el useEffect de matchMedia más abajo).
  const offersSlideSize = isMobile ? OFFERS_SLIDE_SIZE_MOBILE : OFFERS_SLIDE_SIZE;
  const offersChunks = useMemo(
    () => chunk(productsPage?.items ?? [], offersSlideSize),
    [productsPage, offersSlideSize],
  );

  // "Colección de la semana": los últimos 5 productos creados de la marca elegida en Marcas del
  // panel de gestión — bloque oculto si no hay ninguna marca elegida. Sin sortBy: el mismo orden por
  // defecto del backend (createdAt desc) ya es "los más nuevos primero".
  const weeklyCollectionBrandId = landingImages?.weeklyCollectionBrand?.id ?? null;
  useEffect(() => {
    if (!weeklyCollectionBrandId) {
      setWeeklyCollectionProducts([]);
      return;
    }
    const params = new URLSearchParams({ brandId: weeklyCollectionBrandId, pageSize: String(WEEKLY_COLLECTION_SIZE) });
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then((page) => setWeeklyCollectionProducts(page.items))
      .catch(() => {});
  }, [weeklyCollectionBrandId]);

  // Link del botón "Ver más": la página de categoría filtrada por esta marca (mismo mecanismo que
  // brandLinkHref usa para el carrusel "Explorá Nuestras Marcas" de acá abajo) — acá hay que resolver
  // la categoría raíz a mano porque este bloque no vive dentro de un loop por categoría como ese.
  const weeklyCollectionBrandFull = brands.find((b) => b.id === weeklyCollectionBrandId) ?? null;
  const weeklyCollectionBrandCategory = weeklyCollectionBrandFull?.categories[0]?.category ?? null;
  const weeklyCollectionRootCategory = weeklyCollectionBrandCategory
    ? weeklyCollectionBrandCategory.parentId
      ? (categories.find((c) => c.id === weeklyCollectionBrandCategory.parentId) ?? null)
      : weeklyCollectionBrandCategory
    : null;
  const weeklyCollectionHref =
    weeklyCollectionBrandFull && weeklyCollectionRootCategory
      ? brandLinkHref(weeklyCollectionRootCategory, weeklyCollectionBrandFull)
      : null;

  // Avanza sola cada 7s; se reinicia cuando el usuario navega a mano (offersAutoKey) para no
  // "pelear" con un click reciente.
  useEffect(() => {
    if (offersChunks.length <= 1) return;
    const timer = setInterval(() => {
      setOffersDirection(1);
      setOffersSlide((s) => (s + 1) % offersChunks.length);
    }, OFFERS_AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [offersChunks.length, offersAutoKey]);

  function goToOffersSlide(index: number, dir: 1 | -1) {
    const total = offersChunks.length;
    if (total === 0) return;
    setOffersDirection(dir);
    setOffersSlide(((index % total) + total) % total);
    setOffersAutoKey((k) => k + 1);
  }

  // En mobile el hero muestra 1 sola imagen por vez (en vez de 3 lado a lado) y el carrusel de
  // ofertas pagina de a 2 (en vez de 5) — ninguno de los dos cambia en PC.
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT);
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Hero: una sola imagen a pantalla completa por vez (antes eran 3 banners lado a lado) — ahora usa
  // el mismo ImageCarousel compartido del resto del sitio (flechas en los costados + autoplay +
  // swipe táctil en mobile, en vez de reimplementar todo ese mecanismo acá).
  const heroImages = landingImages?.heroImages ?? [];

  const brandName = empresa?.nombre ?? "Ethereal Scents";

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      {/* ============ 2. Hero: una imagen a pantalla completa ============ */}
      {heroImages.length > 0 && (
        <section className="landing-hero-banners">
          <div className="landing-hero-banner-frame">
            <ImageCarousel images={heroImages} alt="" imgClassName="landing-hero-banner-image" autoplayMs={HERO_AUTOPLAY_MS} />
          </div>
        </section>
      )}

      {/* ================= 2b. Confianza ================= */}
      <section className="landing-trust-bar">
        <div className="landing-container landing-trust-bar-grid">
          <div className="landing-trust-item">
            <span className="landing-trust-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 5 6v5c0 4.5 3 8.4 7 9.9 4-1.5 7-5.4 7-9.9V6l-7-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <div>
              <p className="landing-trust-title">100% originales</p>
              <p className="landing-trust-subtitle">Con garantía de autenticidad</p>
            </div>
          </div>

          <div className="landing-trust-item">
            <span className="landing-trust-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7h11v9H3z" />
                <path d="M14 10h4l3 3v3h-7z" />
                <circle cx="7.5" cy="18" r="1.6" />
                <circle cx="17.5" cy="18" r="1.6" />
              </svg>
            </span>
            <div>
              <p className="landing-trust-title">Envío a todo el país</p>
              <p className="landing-trust-subtitle">Envío gratuito en compras a partir de 1.000 Bs</p>
            </div>
          </div>

          <div className="landing-trust-item">
            <span className="landing-trust-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.2" />
                <rect x="14" y="3" width="7" height="7" rx="1.2" />
                <rect x="3" y="14" width="7" height="7" rx="1.2" />
                <rect x="14" y="14" width="3" height="3" rx="0.6" />
                <rect x="18" y="14" width="3" height="3" rx="0.6" />
                <rect x="14" y="18" width="3" height="3" rx="0.6" />
                <rect x="18" y="18" width="3" height="3" rx="0.6" />
              </svg>
            </span>
            <div>
              <p className="landing-trust-title">Pago por QR</p>
              <p className="landing-trust-subtitle">O transferencia bancaria</p>
            </div>
          </div>

          <div className="landing-trust-item">
            <span className="landing-trust-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3C7 3 3 6.6 3 11c0 2.1 1 4 2.6 5.4L5 21l4.8-1.9c.7.2 1.4.3 2.2.3 5 0 9-3.6 9-8S17 3 12 3Z" />
                <circle cx="8.5" cy="11" r="0.9" fill="currentColor" stroke="none" />
                <circle cx="12" cy="11" r="0.9" fill="currentColor" stroke="none" />
                <circle cx="15.5" cy="11" r="0.9" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <div>
              <p className="landing-trust-title">Asesoría por WhatsApp</p>
              <p className="landing-trust-subtitle">Te ayudamos a elegir</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 3. Descuento y Ofertas ================= */}
      <section id="catalogo" className="landing-section landing-section--offers-dark">
        <div className="landing-container">
          <p className="landing-eyebrow">Catálogo</p>
          <h2 className="landing-section-title">Descuento y Ofertas</h2>
          <p className="landing-section-lead">Los últimos productos en oferta — filtrá por categoría.</p>

          {/* 1ra fila: modo (Ofertas Flash = temporizador vigente / Descuentos = precio rebajado) —
              independiente de la categoría, que se elige aparte en la 2da fila de acá abajo. */}
          <div className="landing-filter-pills landing-filter-pills--row1">
            {hasFlashOffers && (
              <button
                type="button"
                className={`landing-pill landing-pill-flash${flashOnly ? " landing-pill-flash-active" : ""}`}
                onClick={() => setFlashOnly(true)}
              >
                Ofertas Flash
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2 3 14h6.5l-1.5 8L21 10h-6.5L13 2Z" />
                </svg>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2 3 14h6.5l-1.5 8L21 10h-6.5L13 2Z" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className={`landing-pill${!flashOnly ? " landing-pill-active" : ""}`}
              onClick={() => setFlashOnly(false)}
            >
              Descuentos
            </button>
          </div>

          {/* 2da fila: categoría — se aplica dentro del modo elegido arriba (Ofertas Flash o
              Descuentos), no lo reemplaza. */}
          <div className="landing-filter-pills">
            {rootCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`landing-pill${categoryFilter === cat.id ? " landing-pill-active" : ""}`}
                onClick={() => setCategoryFilter(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {error && <p className="error-text">{error}</p>}
          {!productsPage && !error && <p className="landing-empty-note">Cargando...</p>}
          {productsPage && productsPage.items.length === 0 && (
            <div className="landing-offers-empty">
              <p className="landing-offers-empty-text">No hay productos en oferta por el momento.</p>
              <a
                className="landing-offers-empty-link"
                href={contacto?.canalOfertasUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Unite al canal de ofertas →
              </a>
            </div>
          )}

          {offersChunks.length > 0 && (
            <div className="landing-carousel">
              <button
                type="button"
                className="landing-carousel-arrow landing-carousel-arrow--prev"
                aria-label="Ofertas anteriores"
                onClick={() => goToOffersSlide(offersSlide - 1, -1)}
                disabled={offersChunks.length <= 1}
              >
                ‹
              </button>

              <div
                className={`landing-product-grid landing-product-grid--carousel${
                  offersDirection === 1 ? " landing-product-grid--carousel-next" : " landing-product-grid--carousel-prev"
                }`}
              >

                {offersChunks[offersSlide].map((product) => (
                  <ProductCard product={product} flashVariant="boxes" key={`${offersSlide}-${product.id}`} />
                ))}
              </div>

              <button
                type="button"
                className="landing-carousel-arrow landing-carousel-arrow--next"
                aria-label="Siguientes ofertas"
                onClick={() => goToOffersSlide(offersSlide + 1, 1)}
                disabled={offersChunks.length <= 1}
              >
                ›
              </button>
            </div>
          )}

          {offersChunks.length > 0 && (
            <div className="landing-offers-channel-cta">
              <a
                className="landing-offers-channel-btn"
                href={contacto?.canalOfertasUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Unirte al canal de ofertas
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ================= 3b. Colección de la semana ================= */}
      {landingImages?.weeklyCollectionBrand && weeklyCollectionProducts.length > 0 && (
        <section className="landing-section landing-section-alt">
          <div className="landing-container">
            <p className="landing-eyebrow">Colección de la semana</p>
            <h2 className="landing-section-title">{landingImages.weeklyCollectionBrand.name}</h2>
            <p className="landing-section-lead">
              Lo último de {landingImages.weeklyCollectionBrand.name}, recién llegado a nuestro catálogo.
            </p>

            <div className="landing-weekly-collection-layout">
              {landingImages.weeklyCollectionBannerImages.length > 0 && (
                <div className="landing-weekly-collection-banner">
                  <ImageCarousel
                    images={landingImages.weeklyCollectionBannerImages}
                    alt=""
                    imgClassName="landing-weekly-collection-banner-image"
                    autoplayMs={WEEKLY_COLLECTION_BANNER_AUTOPLAY_MS}
                  />
                </div>
              )}

              <div className="landing-product-grid landing-product-grid--weekly">
                {weeklyCollectionProducts.map((product) => (
                  <ProductCard product={product} key={product.id} />
                ))}
              </div>

              {weeklyCollectionHref && (
                <div className="landing-weekly-collection-more">
                  <Link href={weeklyCollectionHref} className="landing-btn landing-btn-outline-dark">
                    Ver más
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ========== 4. Producto destacado: banner con título superpuesto (alterna fondo) ========== */}
      {rootCategories.map((cat, i) => {
        // Marcas asignadas a alguna subcategoría de esta categoría raíz (una marca nunca se
        // asigna directo a una raíz — ver BrandsPage/assertCategoriesExist).
        const categoryBrands = brands.filter((b) => b.categories.some((bc) => bc.category.parentId === cat.id));
        // Fondo negro (Black Steel) para el primer bloque, papel para el siguiente, y así alterna —
        // .landing-feature-block--dark/--light ajustan el color de letras/tema para cada caso.
        const isDark = i % 2 === 0;
        return (
          <section
            className={`landing-feature-block ${isDark ? "landing-feature-block--dark" : "landing-feature-block--light"}`}
            key={cat.id}
          >
            <div className="landing-container">
              <h2 className="landing-section-title landing-feature-block-title">
                <span className="landing-feature-block-title-inner">{cat.name}</span>
              </h2>

              {cat.carouselImages.length > 0 ? (
                <div className="landing-feature-visual">
                  <ImageCarousel
                    images={cat.carouselImages}
                    alt={cat.name}
                    imgClassName="landing-feature-visual-image"
                    autoplayMs={FEATURE_AUTOPLAY_MS}
                    visibleCount={isMobile ? 1 : 3}
                    mobileMediaQuery={MOBILE_BREAKPOINT}
                    renderOverlay={(image) => (
                      <div className="landing-feature-overlay">
                        <div className="landing-feature-overlay-text">
                          {image.titulo1 && <p className="landing-feature-overlay-subtitle">{image.titulo1}</p>}
                          {image.titulo2 && <h3 className="landing-feature-overlay-title">{image.titulo2}</h3>}
                        </div>
                        {image.url && (
                          <a href={image.url} className="landing-btn landing-btn-primary landing-feature-overlay-btn">
                            Ver Todo
                          </a>
                        )}
                      </div>
                    )}
                  />
                </div>
              ) : (
                <Link
                  href={`/categoria/${cat.slug}`}
                  className="landing-feature-visual landing-feature-visual--fallback"
                  style={{ background: isDark ? "linear-gradient(150deg, #594d46, #080706)" : "linear-gradient(150deg, #d1b280, #594d46)" }}
                />
              )}

              {categoryBrands.length > 0 && (
                <div className="landing-brands-block">
                  <p className="landing-eyebrow landing-brands-eyebrow">Explora Nuestras Marcas</p>
                  <BrandsCarousel brands={categoryBrands} rootCategory={cat} />
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* ============================== 6. Sobre nosotros ============================== */}
      <section id="nosotros" className="landing-section landing-section-alt">
        <div className="landing-container landing-about">
          <div>
            <p className="landing-eyebrow">Nuestra historia</p>
            <h2 className="landing-section-title">Sobre {brandName}</h2>
            {/* Texto de ejemplo — reemplazar por la historia/misión real de la marca. */}
            <p>
              Empezamos {brandName} con una idea simple: que comprar los productos que te gustan no debería
              significar visitar cinco tiendas distintas. Seleccionamos cada marca que sumamos a nuestro catálogo
              pensando en calidad y variedad real.
            </p>
            <p>Hoy seguimos creciendo, siempre con el mismo criterio: menos vueltas, más de lo que buscás.</p>
            <button type="button" className="landing-btn landing-btn-outline-dark" onClick={() => scrollToId("contacto")}>
              Conocer más
            </button>
          </div>
        </div>
      </section>

      {/* ============================== 7. Newsletter ============================== */}
      <section className="landing-section landing-newsletter">
        <div className="landing-container">
          <p className="landing-eyebrow">Newsletter</p>
          <h2 className="landing-section-title">Enterate de nuestras novedades</h2>
          <p className="landing-section-lead" style={{ margin: "0 auto 32px" }}>
            Lanzamientos, ofertas y novedades del catálogo
          </p>
          <div className="landing-newsletter-form">
            <a
              className="landing-btn landing-btn-primary"
              href={contacto?.canalOfertasUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
            >
              Canal de ofertas
            </a>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

/** Carrusel de logos de marca de una categoría raíz (sus subcategorías) — mismo mecanismo que el
 * carrusel de "Descuento y Ofertas" de arriba (flechas + autoplay), de 8 en 8. */
function BrandsCarousel({ brands, rootCategory }: { brands: Brand[]; rootCategory: { id: string; slug: string } }) {
  const [slide, setSlide] = useState(0);
  const [autoKey, setAutoKey] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const chunks = useMemo(() => chunk(brands, BRANDS_SLIDE_SIZE), [brands]);

  useEffect(() => {
    if (chunks.length <= 1) return;
    const timer = setInterval(() => {
      setDirection(1);
      setSlide((s) => (s + 1) % chunks.length);
    }, BRANDS_AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [chunks.length, autoKey]);

  function goTo(index: number, dir: 1 | -1) {
    const total = chunks.length;
    if (total === 0) return;
    setDirection(dir);
    setSlide(((index % total) + total) % total);
    setAutoKey((k) => k + 1);
  }

  if (chunks.length === 0) return null;

  return (
    <div className="landing-carousel landing-brands-carousel">
      <button
        type="button"
        className="landing-carousel-arrow landing-carousel-arrow--prev"
        aria-label="Marcas anteriores"
        onClick={() => goTo(slide - 1, -1)}
        disabled={chunks.length <= 1}
      >
        ‹
      </button>

      <div className={`landing-brand-grid${direction === 1 ? " landing-brand-grid--next" : " landing-brand-grid--prev"}`} key={slide}>
        {chunks[slide].map((brand) => (
          <Link href={brandLinkHref(rootCategory, brand)} className="landing-brand-card" key={brand.id} title={brand.name}>
            {brand.logoUrl ? (
              <img className="landing-brand-logo" src={productImageSrc(brand.logoUrl)!} alt={brand.name} />
            ) : (
              <div className="landing-brand-logo-placeholder">{brand.name.slice(0, 1)}</div>
            )}
          </Link>
        ))}
      </div>

      <button
        type="button"
        className="landing-carousel-arrow landing-carousel-arrow--next"
        aria-label="Siguientes marcas"
        onClick={() => goTo(slide + 1, 1)}
        disabled={chunks.length <= 1}
      >
        ›
      </button>
    </div>
  );
}
