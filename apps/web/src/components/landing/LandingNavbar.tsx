"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiGet, getCasaMatrizLogo } from "../../lib/api";
import { cardImageUrl, displayPrice, productImageSrc } from "../../lib/catalog-display";
import type { Category, Page, Product } from "../../lib/types";
import { formatCartAtributos } from "../proformas/AtributosVisibles";

const SEARCH_RESULTS_LIMIT = 7;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Navbar de todo el sitio público. "Nosotros" y "Contacto" intentan hacer scroll a una sección con
 * ese id en la página actual (el footer trae #contacto en todas partes); si no existe, navegan a
 * /home con el hash correspondiente.
 *
 * variant="default": transparente sobre el contenido al cargar, pasa a la misma variante oscura de
 * abajo (fondo negro sólido) recién al superar ~80px de scroll — para el home, con el hero de fondo
 * debajo.
 * variant="dark": fondo negro fijo, sin depender del scroll — para páginas sin hero de fondo debajo
 * (detalle de producto, categoría, marcas).
 *
 * overlay=true (default): el navbar es `position: fixed`, sobrepuesto al contenido — el hero de esa
 * página debe compensar con su propio padding-top para no quedar tapado. overlay=false: el navbar
 * ocupa su propio espacio en el flujo normal (`position: sticky`) — el hero arranca separado, justo
 * debajo, sin superponerse ni necesitar ese padding extra.
 */
export function LandingNavbar({
  variant = "default",
  overlay = true,
}: {
  variant?: "default" | "dark";
  overlay?: boolean;
}) {
  const [empresa, setEmpresa] = useState<{ nombre: string | null; logoUrl: string | null } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const rootCategories = categories.filter((cat) => cat.parentId === null);
  const categoryTree = rootCategories.map((cat) => ({
    ...cat,
    children: categories.filter((c) => c.parentId === cat.id),
  }));

  useEffect(() => {
    getCasaMatrizLogo().then(setEmpresa).catch(() => {});
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  // Dispara el cambio de color a --dark al pasar ~80px de scroll (ver navbarClass) — solo aplica en
  // variant="default", la única con un estado inicial distinto del oscuro.
  useEffect(() => {
    if (variant !== "default") return;
    function handleScroll() {
      setScrolled(window.scrollY > 80);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [variant]);

  // Ya en /home: en vez de navegar (no hace nada, Next.js no re-renderiza la misma ruta), sube al
  // hero con scroll suave — en cualquier otra página, el Link de abajo navega a /home normal.
  function handleLogoClick() {
    setMobileMenuOpen(false);
    if (pathname === "/home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goToSection(id: string) {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push(`/home#${id}`);
    }
  }

  // Busca mientras se tipea (debounce 300ms) — pide 1 de más que el límite visible para saber si
  // hace falta el botón "Ver más..." sin depender de `total` (que puede no venir del todo afinado).
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchTotal(0);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ search: query, pageSize: String(SEARCH_RESULTS_LIMIT + 1) });
      apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
        .then((page) => {
          setSearchResults(page.items.slice(0, SEARCH_RESULTS_LIMIT));
          setSearchTotal(page.total);
        })
        .catch(() => {})
        .finally(() => setSearchLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  function closeSearch() {
    // Delay para que un click sobre un resultado/"Ver más" llegue a disparar antes de que el
    // blur del input cierre el desplegable.
    setTimeout(() => setSearchOpen(false), 150);
  }

  function goToSearchResults() {
    const query = searchQuery.trim();
    if (!query) return;
    setSearchOpen(false);
    setMobileMenuOpen(false);
    router.push(`/buscar?q=${encodeURIComponent(query)}`);
  }

  const logoSrc = productImageSrc(empresa?.logoUrl ?? null);
  const brandName = empresa?.nombre ?? "Ethereal Scents";
  const navbarClass = [
    "landing-navbar",
    variant === "dark" || (variant === "default" && scrolled) ? "landing-navbar--dark" : "",
    !overlay ? "landing-navbar--static" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={navbarClass}>
      {/* Fila principal: logo a la izquierda, buscador al centro, utilidades a la derecha — mismo
          orden que pontocom.com. Las categorías van en su propia fila debajo (ver
          .landing-navbar-categories), como su mega-menú separado. */}
      <div className="landing-container landing-navbar-inner">
        <Link href="/home" className="landing-navbar-brand" onClick={handleLogoClick}>
          {logoSrc ? <img className="landing-navbar-logo" src={logoSrc} alt={brandName} /> : brandName}
        </Link>

        <div className="landing-navbar-search">
          <svg className="landing-navbar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            className="landing-navbar-search-input"
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            onBlur={closeSearch}
            onKeyDown={(e) => {
              if (e.key === "Enter") goToSearchResults();
            }}
          />

          {searchOpen && searchQuery.trim() && (
            <div className="landing-navbar-search-dropdown">
              {searchLoading && <p className="landing-navbar-search-empty">Buscando...</p>}
              {!searchLoading && searchResults.length === 0 && (
                <p className="landing-navbar-search-empty">Sin resultados para &quot;{searchQuery.trim()}&quot;.</p>
              )}
              {!searchLoading &&
                searchResults.map((product) => {
                  const { variant } = displayPrice(product);
                  const image = productImageSrc(cardImageUrl(product, variant));
                  const atributos = formatCartAtributos(product.attributeValues, product.variantOptionValues, variant?.options ?? []);
                  return (
                    <Link
                      href={`/producto/${product.slug}`}
                      className="landing-navbar-search-result"
                      key={product.id}
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      {image ? (
                        <img className="landing-navbar-search-result-image" src={image} alt={product.name} />
                      ) : (
                        <div className="landing-navbar-search-result-image-placeholder">{product.name.slice(0, 1)}</div>
                      )}
                      <span className="landing-navbar-search-result-info">
                        <span className="landing-navbar-search-result-name">{product.name}</span>
                        {atributos && <span className="landing-navbar-search-result-attrs">{atributos}</span>}
                      </span>
                    </Link>
                  );
                })}
              {!searchLoading && searchTotal > SEARCH_RESULTS_LIMIT && (
                <button type="button" className="landing-navbar-search-more" onClick={goToSearchResults}>
                  Ver más...
                </button>
              )}
            </div>
          )}
        </div>

        <div className="landing-navbar-actions">
          <a className="landing-navbar-actions-link" href="#nosotros" onClick={(e) => { e.preventDefault(); goToSection("nosotros"); }}>Nosotros</a>
          <a className="landing-navbar-actions-link" href="#contacto" onClick={(e) => { e.preventDefault(); goToSection("contacto"); }}>Contacto</a>
          <Link href="/dashboard" className="landing-btn landing-btn-primary">Gestión</Link>
          <button
            type="button"
            className={`landing-navbar-toggle${mobileMenuOpen ? " landing-navbar-toggle--open" : ""}`}
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* Segunda fila: categorías/ofertas/marcas, como el "menu-top" separado de pontocom.com. */}
      <div className="landing-navbar-categories">
        <div className="landing-container">
          <nav className="landing-navbar-links">
            {categoryTree.map((cat) => (
              <div className="landing-navbar-item" key={cat.id}>
                <Link href={`/categoria/${cat.slug}`} onClick={() => setMobileMenuOpen(false)}>
                  {cat.name}
                </Link>
                {cat.children.length > 0 && (
                  <div className="landing-navbar-dropdown">
                    <div className="landing-navbar-dropdown-group">
                      {cat.children.map((sub) => (
                        <Link key={sub.id} href={`/categoria/${sub.slug}`} onClick={() => setMobileMenuOpen(false)}>
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="landing-navbar-item">
              <a className="landing-navbar-ofertas" href="#catalogo" onClick={(e) => e.preventDefault()}>¡¡OFERTAS!!</a>
              <div className="landing-navbar-dropdown">
                {rootCategories.map((cat) => (
                  <div className="landing-navbar-dropdown-group" key={cat.id}>
                    <Link
                      className="landing-navbar-dropdown-heading"
                      href={`/categoria/${cat.slug}?descuento=true`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {cat.name}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
            <Link href="/marcas" onClick={() => setMobileMenuOpen(false)}>Marcas</Link>
          </nav>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav className="landing-navbar-mobile">
          {categoryTree.map((cat) => (
            <div className="landing-navbar-mobile-group" key={cat.id}>
              <Link
                className="landing-navbar-mobile-heading"
                href={`/categoria/${cat.slug}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {cat.name}
              </Link>
              {cat.children.map((sub) => (
                <Link
                  key={sub.id}
                  className="landing-navbar-mobile-sub"
                  href={`/categoria/${sub.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          ))}
          <p className="landing-navbar-mobile-heading">¡¡OFERTAS!!</p>
          {rootCategories.map((cat) => (
            <Link
              key={`oferta-${cat.id}`}
              className="landing-navbar-mobile-sub"
              href={`/categoria/${cat.slug}?descuento=true`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {cat.name}
            </Link>
          ))}
          <Link href="/marcas" onClick={() => setMobileMenuOpen(false)}>Marcas</Link>
          <a href="#nosotros" onClick={(e) => { e.preventDefault(); goToSection("nosotros"); }}>Nosotros</a>
          <a href="#contacto" onClick={(e) => { e.preventDefault(); goToSection("contacto"); }}>Contacto</a>
          <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>Gestión</Link>
        </nav>
      )}
    </header>
  );
}
