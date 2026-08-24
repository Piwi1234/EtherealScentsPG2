"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, getCasaMatrizLogo, getLandingImages } from "../../lib/api";
import { cardImageUrl, displayPrice, productImageSrc } from "../../lib/catalog-display";
import type { Category, Page, Product } from "../../lib/types";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { formatAtributosVisiblesValores } from "../../components/proformas/AtributosVisibles";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const OFFERS_SLIDE_SIZE = 5;
const OFFERS_AUTOPLAY_MS = 7000;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export default function HomePage() {
  // --- Datos: empresa (nombre para textos propios), categorías reales y productos del catálogo público ---
  const [empresa, setEmpresa] = useState<{ nombre: string | null } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productsPage, setProductsPage] = useState<Page<Product> | null>(null);
  const [offersSlide, setOffersSlide] = useState(0);
  const [offersAutoKey, setOffersAutoKey] = useState(0);
  const [landingImages, setLandingImages] = useState<{
    heroImageUrl: string | null;
    valueImageUrl: string | null;
    aboutImageUrl: string | null;
  } | null>(null);
  const [error, setError] = useState("");

  const rootCategories = categories.filter((cat) => cat.parentId === null);

  useEffect(() => {
    getCasaMatrizLogo().then(setEmpresa).catch(() => {});
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    getLandingImages().then(setLandingImages).catch(() => {});
  }, []);

  // Carrusel de "Descuento y Ofertas": últimos 40 productos con descuento (por fecha de última
  // modificación), de 5 en 5.
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

  // Avanza sola cada 7s; se reinicia cuando el usuario navega a mano (offersAutoKey) para no
  // "pelear" con un click reciente.
  useEffect(() => {
    if (offersChunks.length <= 1) return;
    const timer = setInterval(() => {
      setOffersSlide((s) => (s + 1) % offersChunks.length);
    }, OFFERS_AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [offersChunks.length, offersAutoKey]);

  function goToOffersSlide(index: number) {
    const total = offersChunks.length;
    if (total === 0) return;
    setOffersSlide(((index % total) + total) % total);
    setOffersAutoKey((k) => k + 1);
  }

  function explorarCategoria(categoryId: string) {
    setCategoryFilter(categoryId);
    scrollToId("catalogo");
  }

  const brandName = empresa?.nombre ?? "Ethereal Scents";

  return (
    <div className="landing-page">
      <LandingNavbar />

      {/* ============================== 2. Hero ============================== */}
      <section
        className="landing-hero"
        style={
          landingImages?.heroImageUrl
            ? {
                backgroundImage: `url(${productImageSrc(landingImages.heroImageUrl)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="landing-container">
          <div className="landing-hero-content">
            <p className="landing-hero-eyebrow">{brandName.toUpperCase()}</p>
            <h1>Todo lo que necesitas en un solo lugar.</h1>
            <p className="landing-hero-subtitle">
              Perfumes y vapes seleccionados, con stock real y precios claros — sin vueltas.
            </p>
            <button type="button" className="landing-btn landing-btn-outline">
              Explora nuestras ofertas
            </button>
          </div>
        </div>
      </section>

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
                onClick={() => goToOffersSlide(offersSlide - 1)}
                disabled={offersChunks.length <= 1}
              >
                ‹
              </button>

              <div className="landing-product-grid landing-product-grid--carousel">
                {offersChunks[offersSlide].map((product) => {
                  const { bs, fromPrice, variant } = displayPrice(product);
                  const image = productImageSrc(cardImageUrl(product, variant));
                  const atributos = formatAtributosVisiblesValores(product.attributeValues, product.variantOptionValues);
                  return (
                    <Link href={`/producto/${product.id}`} className="landing-product-card" key={product.id}>
                      {image ? (
                        <img className="landing-product-image" src={image} alt={product.name} />
                      ) : (
                        <div className="landing-product-image-placeholder">{product.name.slice(0, 1)}</div>
                      )}
                      <div className="landing-product-body">
                        {product.brand && <span className="landing-product-brand">{product.brand.name}</span>}
                        <p className="landing-product-name">{product.name}</p>
                        {atributos && <p className="landing-product-attrs">{atributos}</p>}
                        <span className="landing-product-price">
                          {fromPrice ? "Desde " : ""}Bs {bs.toFixed(2)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              <button
                type="button"
                className="landing-carousel-arrow landing-carousel-arrow--next"
                aria-label="Siguientes ofertas"
                onClick={() => goToOffersSlide(offersSlide + 1)}
                disabled={offersChunks.length <= 1}
              >
                ›
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ========== 4. Producto/servicio destacado (alterna lado de imagen) ========== */}
      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          {rootCategories.map((cat, i) => (
            <div className={`landing-feature${i % 2 === 1 ? " landing-feature-reverse" : ""}`} key={cat.id}>
              <div className="landing-feature-text">
                <p className="landing-eyebrow">Destacado</p>
                <h2 className="landing-section-title">{cat.name}</h2>
                <p>
                  Descubrí nuestra selección de {cat.name.toLowerCase()} — curada para que encuentres justo lo
                  que buscás, con disponibilidad real.
                </p>
                <button type="button" className="landing-btn landing-btn-outline-dark" onClick={() => explorarCategoria(cat.id)}>
                  Explorar {cat.name}
                </button>
              </div>
              {cat.heroImageUrl ? (
                <div className="landing-feature-visual">
                  <img className="landing-feature-visual-image" src={productImageSrc(cat.heroImageUrl)!} alt={cat.name} />
                </div>
              ) : (
                <div
                  className="landing-feature-visual"
                  style={{ background: i % 2 === 0 ? "linear-gradient(150deg, #9184d9, #4b3f8f)" : "linear-gradient(150deg, #201c33, #100e1c)" }}
                >
                  {cat.name}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

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
      {/* Solo interfaz por ahora — no hay endpoint de suscripción todavía, falta conectar. */}
      <section className="landing-section landing-newsletter">
        <div className="landing-container">
          <p className="landing-eyebrow">Newsletter</p>
          <h2 className="landing-section-title">Enterate de nuestras novedades</h2>
          <p className="landing-section-lead" style={{ margin: "0 auto 32px" }}>
            Lanzamientos, ofertas y novedades del catálogo, directo a tu correo.
          </p>
          <form
            className="landing-newsletter-form"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input type="email" required placeholder="Tu email" aria-label="Email" />
            <button type="submit" className="landing-btn landing-btn-primary">
              Suscribirme
            </button>
          </form>
          <p className="landing-newsletter-note">Todavía no está conectado a un servicio de envío — próximamente.</p>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
