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

const OFFERS_SLIDE_SIZE = 4;
const OFFERS_AUTOPLAY_MS = 7000;
const OFFERS_BANNER_AUTOPLAY_MS = 10000;
const BRANDS_SLIDE_SIZE = 8;
const BRANDS_AUTOPLAY_MS = 10000;
const HERO_AUTOPLAY_MS = 10000;
const HERO_BANNERS_SLIDE_SIZE = 3;
const FEATURE_AUTOPLAY_MS = 10000;
const WEEKLY_COLLECTION_BANNER_AUTOPLAY_MS = 10000;
const WEEKLY_COLLECTION_SIZE = 8;

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
  const [productsPage, setProductsPage] = useState<Page<Product> | null>(null);
  const [offersSlide, setOffersSlide] = useState(0);
  const [offersAutoKey, setOffersAutoKey] = useState(0);
  const [offersDirection, setOffersDirection] = useState<1 | -1>(1);
  const [heroSlide, setHeroSlide] = useState(0);
  const [heroAutoKey, setHeroAutoKey] = useState(0);
  const [heroDirection, setHeroDirection] = useState<1 | -1>(1);
  const [landingImages, setLandingImages] = useState<{
    heroImages: CarouselImage[];
    offersBannerImages: CarouselImage[];
    weeklyCollectionBannerImages: CarouselImage[];
    weeklyCollectionBrand: { id: string; name: string; slug: string; logoUrl: string | null } | null;
    valueImageUrl: string | null;
    aboutImageUrl: string | null;
  } | null>(null);
  const [weeklyCollectionProducts, setWeeklyCollectionProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [contacto, setContacto] = useState<ContactoInfo | null>(null);

  const rootCategories = categories.filter((cat) => cat.parentId === null);

  useEffect(() => {
    getCasaMatrizLogo().then(setEmpresa).catch(() => {});
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    getBrands().then(setBrands).catch(() => {});
    getLandingImages().then(setLandingImages).catch(() => {});
    apiGet<ContactoInfo>("/settings/contacto-info").then(setContacto).catch(() => {});
  }, []);

  // Carrusel de "Descuento y Ofertas": últimos 40 productos con descuento (por fecha de última
  // modificación), de 4 en 4 — el 5to lugar de la fila lo ocupa el banner de ofertas (ver abajo).
  useEffect(() => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set("categoryId", categoryFilter);
    params.set("pageSize", "40");
    params.set("onlyDiscounted", "true");
    params.set("sortBy", "actualizados");
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then((page) => {
        setProductsPage(page);
        setOffersSlide(0);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [categoryFilter]);

  const offersChunks = useMemo(() => chunk(productsPage?.items ?? [], OFFERS_SLIDE_SIZE), [productsPage]);

  // "Colección de la semana": los últimos 12 productos creados de la marca elegida en Marcas del
  // panel de gestión — bloque oculto si no hay ninguna marca elegida.
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

  // Hero: carrusel de 3 banners lado a lado (ver Grid Imágenes → Hero principal) que rota de a UNA
  // imagen por vez (ventana deslizante), no de a grupos de 3 — mismo mecanismo de dirección/autoplay
  // que el resto de los carruseles del home.
  const heroImages = landingImages?.heroImages ?? [];
  const heroWindowSize = Math.min(HERO_BANNERS_SLIDE_SIZE, heroImages.length);
  const heroWindow = useMemo(
    () => Array.from({ length: heroWindowSize }, (_, i) => heroImages[(heroSlide + i) % heroImages.length]),
    [heroImages, heroSlide, heroWindowSize],
  );

  useEffect(() => {
    if (heroImages.length <= heroWindowSize) return;
    const timer = setInterval(() => {
      setHeroDirection(1);
      setHeroSlide((s) => (s + 1) % heroImages.length);
    }, HERO_AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [heroImages.length, heroWindowSize, heroAutoKey]);

  function goToHeroSlide(index: number, dir?: 1 | -1) {
    const total = heroImages.length;
    if (total === 0) return;
    const nextSlide = ((index % total) + total) % total;
    setHeroDirection(dir ?? (nextSlide >= heroSlide ? 1 : -1));
    setHeroSlide(nextSlide);
    setHeroAutoKey((k) => k + 1);
  }

  const brandName = empresa?.nombre ?? "Ethereal Scents";

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      {/* ============ 2. Hero: carrusel de 3 banners lado a lado ============ */}
      {heroWindow.length > 0 && (
        <section className="landing-hero-banners">
          <div style={{ position: "relative" }}>
            <div
              className={`landing-hero-banner-grid${
                heroDirection === 1 ? " landing-hero-banner-grid--next" : " landing-hero-banner-grid--prev"
              }`}
              style={heroWindowSize < 3 ? { gridTemplateColumns: `repeat(${heroWindowSize}, 1fr)` } : undefined}
              key={heroSlide}
            >
              {heroWindow.map((image) => {
                const content = (
                  <img className="landing-hero-banner-image" src={productImageSrc(image.imageUrl)!} alt="" />
                );
                return image.url ? (
                  <a
                    key={image.id}
                    className="landing-hero-banner-card"
                    href={image.url}
                  >
                    {content}
                  </a>
                ) : (
                  <div key={image.id} className="landing-hero-banner-card">
                    {content}
                  </div>
                );
              })}
            </div>
            {heroImages.length > heroWindowSize && (
              <div className="landing-image-carousel-dots">
                {heroImages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`landing-image-carousel-dot${i === heroSlide ? " landing-image-carousel-dot--active" : ""}`}
                    aria-label={`Ir al banner ${i + 1}`}
                    onClick={() => goToHeroSlide(i)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ================= 3. Descuento y Ofertas ================= */}
      <section id="catalogo" className="landing-section">
        <div className="landing-container">
          <p className="landing-eyebrow">Catálogo</p>
          <h2 className="landing-section-title">Descuento y Ofertas</h2>
          <p className="landing-section-lead">Los últimos productos en oferta — filtrá por categoría.</p>

          <div className="landing-filter-pills">
            <button
              type="button"
              className={`landing-pill${categoryFilter === "" ? " landing-pill-active" : ""}`}
              onClick={() => setCategoryFilter("")}
            >
              Todas
            </button>
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
            {/* Todavía sin lógica de filtro propia — falta definir cómo se usa (pendiente). */}
            <button type="button" className="landing-pill landing-pill-flash">
              Ofertas Flash
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2 3 14h6.5l-1.5 8L21 10h-6.5L13 2Z" />
              </svg>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2 3 14h6.5l-1.5 8L21 10h-6.5L13 2Z" />
              </svg>
            </button>
          </div>

          {error && <p className="error-text">{error}</p>}
          {!productsPage && !error && <p className="landing-empty-note">Cargando...</p>}
          {productsPage && productsPage.items.length === 0 && (
            <p className="landing-empty-note">No hay productos en oferta por el momento.</p>
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
                  <ProductCard product={product} key={`${offersSlide}-${product.id}`} />
                ))}
                {landingImages && landingImages.offersBannerImages.length > 0 && (
                  <div className="landing-offers-banner">
                    <ImageCarousel
                      images={landingImages.offersBannerImages}
                      alt=""
                      imgClassName="landing-offers-banner-image"
                      autoplayMs={OFFERS_BANNER_AUTOPLAY_MS}
                    />
                  </div>
                )}
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

            <div
              className={`landing-weekly-collection-layout${
                landingImages.weeklyCollectionBannerImages.length === 0 ? " landing-weekly-collection-layout--no-banner" : ""
              }`}
            >
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
                    visibleCount={3}
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

      {/* ================= 5. Propuesta de valor / diferenciador ================= */}
      <section className="landing-section">
        <div className="landing-container landing-value">
          <div>
            <p className="landing-eyebrow">Por qué elegirnos</p>
            <h2>Todo lo que necesitas en un solo lugar.</h2>
            <p>
              Reunimos marcas y productos que normalmente tendrías que buscar en varios lugares distintos, con
              información clara de precio y disponibilidad desde el primer momento — sin sorpresas.
            </p>
          </div>
          {landingImages?.valueImageUrl ? (
            <img className="landing-value-visual" src={productImageSrc(landingImages.valueImageUrl)!} alt="" />
          ) : (
            <div className="landing-value-visual" />
          )}
        </div>
      </section>

      {/* ============================== 6. Sobre nosotros ============================== */}
      <section id="nosotros" className="landing-section landing-section-alt">
        <div className="landing-container landing-about">
          {landingImages?.aboutImageUrl ? (
            <img className="landing-about-visual" src={productImageSrc(landingImages.aboutImageUrl)!} alt="" />
          ) : (
            <div className="landing-about-visual" />
          )}
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
