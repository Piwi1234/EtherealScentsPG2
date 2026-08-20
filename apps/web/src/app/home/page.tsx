"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_ORIGIN, apiGet, getCasaMatrizLogo } from "../../lib/api";
import type { Category, Page, Product } from "../../lib/types";

function productImageSrc(imageUrl: string | null): string | null {
  return imageUrl ? `${API_ORIGIN}${imageUrl}` : null;
}

/** Si el producto tiene variantes con precio propio, se muestra "Desde" el precio más bajo entre ellas. */
function displayPrice(product: Product): { bs: number; usd: number; fromPrice: boolean } {
  if (product.variants.length > 0) {
    const cheapest = product.variants.reduce((min, v) => (v.finalPriceBs < min.finalPriceBs ? v : min), product.variants[0]);
    return { bs: cheapest.finalPriceBs, usd: cheapest.price, fromPrice: product.variants.length > 1 };
  }
  return { bs: product.finalPriceBs, usd: product.price, fromPrice: false };
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function HomePage() {
  // --- Datos: empresa (logo del navbar), categorías reales y productos del catálogo público ---
  const [empresa, setEmpresa] = useState<{ nombre: string | null; logoUrl: string | null } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productsPage, setProductsPage] = useState<Page<Product> | null>(null);
  const [error, setError] = useState("");

  const rootCategories = categories.filter((cat) => cat.parentId === null);

  useEffect(() => {
    getCasaMatrizLogo().then(setEmpresa).catch(() => {});
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set("categoryId", categoryFilter);
    params.set("pageSize", "48");
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then(setProductsPage)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [categoryFilter]);

  function explorarCategoria(categoryId: string) {
    setCategoryFilter(categoryId);
    scrollToId("catalogo");
  }

  const logoSrc = productImageSrc(empresa?.logoUrl ?? null);
  const brandName = empresa?.nombre ?? "Ethereal Scents";

  return (
    <div className="landing-page">
      {/* ============================== 1. Navbar ============================== */}
      <header className="landing-navbar">
        <div className="landing-container landing-navbar-inner">
          <div className="landing-navbar-brand">
            {logoSrc && <img className="landing-navbar-logo" src={logoSrc} alt={brandName} />}
            {brandName}
          </div>
          <nav className="landing-navbar-links">
            {rootCategories.map((cat) => (
              <a key={cat.id} href="#catalogo" onClick={(e) => { e.preventDefault(); explorarCategoria(cat.id); }}>
                {cat.name}
              </a>
            ))}
            <a href="#nosotros" onClick={(e) => { e.preventDefault(); scrollToId("nosotros"); }}>Nosotros</a>
            <a href="#contacto" onClick={(e) => { e.preventDefault(); scrollToId("contacto"); }}>Contacto</a>
          </nav>
          <div className="landing-navbar-actions">
            <Link href="/dashboard" className="landing-navbar-manage">Gestión</Link>
            <button type="button" className="landing-btn landing-btn-primary" onClick={() => scrollToId("catalogo")}>
              Ver catálogo
            </button>
          </div>
        </div>
      </header>

      {/* ============================== 2. Hero ============================== */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <p className="landing-hero-eyebrow">{brandName.toUpperCase()}</p>
          <h1>Todo lo que necesitas en un solo lugar.</h1>
          <p className="landing-hero-subtitle">
            Perfumes y vapes seleccionados, con stock real y precios claros — sin vueltas.
          </p>
          <button type="button" className="landing-btn landing-btn-outline" onClick={() => scrollToId("catalogo")}>
            Ver catálogo
          </button>
        </div>
      </section>

      {/* ================= 3. Grid de categorías/productos ================= */}
      <section id="catalogo" className="landing-section">
        <div className="landing-container">
          <p className="landing-eyebrow">Catálogo</p>
          <h2 className="landing-section-title">Explorá lo que tenemos</h2>
          <p className="landing-section-lead">Datos en vivo de nuestro catálogo — filtrá por categoría.</p>

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
            <p className="landing-empty-note">No hay productos para mostrar todavía.</p>
          )}

          {productsPage && productsPage.items.length > 0 && (
            <div className="landing-product-grid">
              {productsPage.items.map((product) => {
                const { bs, usd, fromPrice } = displayPrice(product);
                const image = productImageSrc(product.imageUrl);
                return (
                  <div className="landing-product-card" key={product.id}>
                    {image ? (
                      <img className="landing-product-image" src={image} alt={product.name} />
                    ) : (
                      <div className="landing-product-image-placeholder">{product.name.slice(0, 1)}</div>
                    )}
                    <div className="landing-product-body">
                      {product.brand && <span className="landing-product-brand">{product.brand.name}</span>}
                      <p className="landing-product-name">{product.name}</p>
                      <span className="landing-product-price">
                        {fromPrice ? "Desde " : ""}Bs {bs.toFixed(2)}
                      </span>
                      <span className="landing-product-price-usd">(${usd.toFixed(2)})</span>
                    </div>
                  </div>
                );
              })}
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
              <div
                className="landing-feature-visual"
                style={{ background: i % 2 === 0 ? "linear-gradient(150deg, #9184d9, #4b3f8f)" : "linear-gradient(150deg, #201c33, #100e1c)" }}
              >
                {cat.name}
              </div>
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
          <div className="landing-value-visual" />
        </div>
      </section>

      {/* ============================== 6. Sobre nosotros ============================== */}
      <section id="nosotros" className="landing-section landing-section-alt">
        <div className="landing-container landing-about">
          <div className="landing-about-visual" />
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

      {/* ============================== 8. Footer ============================== */}
      <footer id="contacto" className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-grid">
            <div>
              <p className="landing-footer-brand">{brandName}</p>
              <p className="landing-footer-tagline">Todo lo que necesitas en un solo lugar.</p>
            </div>
            <div className="landing-footer-col">
              <p className="landing-footer-col-title">Catálogo</p>
              {rootCategories.map((cat) => (
                <a key={cat.id} href="#catalogo" onClick={(e) => { e.preventDefault(); explorarCategoria(cat.id); }}>
                  {cat.name}
                </a>
              ))}
              <Link href="/dashboard">Gestión</Link>
            </div>
            <div className="landing-footer-col">
              <p className="landing-footer-col-title">Contacto</p>
              {/* Datos de ejemplo — reemplazar por los reales. */}
              <p>+591 700 00000</p>
              <p>hola@etherealscents.com</p>
              <p>Cochabamba, Bolivia</p>
            </div>
            <div className="landing-footer-col">
              <p className="landing-footer-col-title">Seguinos</p>
              {/* Enlaces de ejemplo — reemplazar por las redes reales. */}
              <div className="landing-footer-social">
                <a href="#" aria-label="Instagram" onClick={(e) => e.preventDefault()}>IG</a>
                <a href="#" aria-label="Facebook" onClick={(e) => e.preventDefault()}>FB</a>
                <a href="#" aria-label="WhatsApp" onClick={(e) => e.preventDefault()}>WA</a>
              </div>
            </div>
          </div>
          <div className="landing-footer-bottom">
            <span>© {new Date().getFullYear()} {brandName}. Todos los derechos reservados.</span>
            <span>Panel de gestión interno — no es una tienda con checkout online.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
