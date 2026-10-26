"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiGet, getCasaMatrizLogo } from "../../lib/api";
import { cardImageUrl, displayPrice, productImageSrc } from "../../lib/catalog-display";
import type { Attribute, Category, Page, Product } from "../../lib/types";
import { formatCartAtributos } from "../proformas/AtributosVisibles";
import { getCustomerUser, type CustomerUser } from "../../lib/customer-auth";
import { getAuthUser } from "../../lib/auth";

/** Sin tildes y en minúsculas, para reconocer el atributo "Género" aunque se escriba distinto. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** Opciones del atributo Género, con el nombre que se muestra en el menú ("Para él", "Para ella", "Unisex"). */
const GENERO_ORDEN = ["masculino", "femenino", "unisex"];
const GENERO_ETIQUETA: Record<string, string> = { masculino: "Para él", femenino: "Para ella" };

type GeneroCategoria = { attributeId: string; opciones: { valor: string; etiqueta: string }[] };

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
  // Por categoría raíz: su atributo "Género" (si tiene) para armar la columna POR PERFIL del menú.
  const [generos, setGeneros] = useState<Record<string, GeneroCategoria>>({});
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  // Menú del celular: un solo grupo abierto a la vez (abrir uno cierra el que estaba abierto).
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
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
    setCustomer(getCustomerUser());
    setIsStaff(getAuthUser() !== null);
  }, []);

  // Género de cada categoría raíz: el menú solo muestra POR PERFIL en las que tienen ese atributo filtrable.
  useEffect(() => {
    const raices = categories.filter((c) => c.parentId === null);
    if (raices.length === 0) return;
    let cancelado = false;
    Promise.all(
      raices.map((cat) =>
        apiGet<Attribute[]>(`/catalog/categories/${cat.id}/filters`)
          .then((attrs): [string, GeneroCategoria | null] => {
            const genero = attrs.find((a) => normalizar(a.name) === "genero");
            if (!genero || genero.options.length === 0) return [cat.id, null];
            const opciones = [...genero.options]
              .sort((a, b) => {
                const ia = GENERO_ORDEN.indexOf(normalizar(a.value));
                const ib = GENERO_ORDEN.indexOf(normalizar(b.value));
                return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
              })
              .map((o) => ({ valor: o.value, etiqueta: GENERO_ETIQUETA[normalizar(o.value)] ?? o.value }));
            return [cat.id, { attributeId: genero.id, opciones }];
          })
          .catch((): [string, GeneroCategoria | null] => [cat.id, null]),
      ),
    ).then((pares) => {
      if (cancelado) return;
      setGeneros(Object.fromEntries(pares.filter((p): p is [string, GeneroCategoria] => p[1] !== null)));
    });
    return () => {
      cancelado = true;
    };
  }, [categories]);

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

  // Bloquea el scroll del fondo mientras el drawer mobile está abierto — si no, se puede scrollear
  // el contenido detrás del overlay a la vez que el drawer, se siente roto. overflow:hidden solo no
  // alcanza en iOS Safari (ahí el body sigue scrolleando por "rubber-banding" aunque tenga
  // overflow:hidden) — position:fixed con el scroll actual guardado en `top` es el fix estándar
  // para iOS, y se restaura el scroll exacto al cerrar.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [mobileMenuOpen]);

  function toggleMobileGroup(id: string) {
    setOpenMobileGroup((actual) => (actual === id ? null : id));
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
    setOpenMobileGroup(null);
  }

  // Ya en /home: en vez de navegar (no hace nada, Next.js no re-renderiza la misma ruta), sube al
  // hero con scroll suave — en cualquier otra página, el Link de abajo navega a /home normal.
  function handleLogoClick() {
    setMobileMenuOpen(false);
    if (pathname === "/home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Con el drawer mobile abierto, el click de "Nosotros"/"Contacto" dispara este scroll ANTES de
  // que corra el cleanup del efecto de arriba (position:fixed) — ese cleanup restaura el scroll a
  // donde estaba al abrir el drawer, deshaciendo el scrollIntoView de acá sin avisar (se sentía
  // como si el botón no hiciera nada). Con el drawer abierto, se guarda el destino en vez de
  // scrollear ya mismo, y se resuelve recién cuando `mobileMenuOpen` pasa a false (ver el efecto de
  // abajo, declarado después del de position:fixed a propósito — los cleanups de un mismo commit
  // corren en orden de declaración antes que los efectos nuevos, así este corre después de ese
  // restore).
  const pendingSectionIdRef = useRef<string | null>(null);

  function goToSection(id: string) {
    if (mobileMenuOpen) {
      pendingSectionIdRef.current = id;
      setMobileMenuOpen(false);
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push(`/home#${id}`);
    }
  }

  useEffect(() => {
    if (mobileMenuOpen) return;
    const id = pendingSectionIdRef.current;
    if (!id) return;
    pendingSectionIdRef.current = null;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      router.push(`/home#${id}`);
    }
  }, [mobileMenuOpen, router]);

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
    setMobileSearchOpen(false);
    router.push(`/buscar?q=${encodeURIComponent(query)}`);
  }

  const logoSrc = productImageSrc(empresa?.logoUrl ?? null);
  const brandName = empresa?.nombre ?? "Ethereal Scents";
  const isDark = variant === "dark" || (variant === "default" && scrolled);
  const navbarClass = ["landing-navbar", isDark ? "landing-navbar--dark" : "", !overlay ? "landing-navbar--static" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <header className={navbarClass}>
      {/* Fila principal: logo a la izquierda, buscador al centro, utilidades a la derecha — mismo
          orden que pontocom.com. Las categorías van en su propia fila debajo (ver
          .landing-navbar-categories), como su mega-menú separado. */}
      <div className="landing-container landing-navbar-inner">
        <Link href="/home" className="landing-navbar-brand" onClick={handleLogoClick}>
          {logoSrc ? <img className="landing-navbar-logo" src={logoSrc} alt={brandName} /> : brandName}
        </Link>

        <div className={`landing-navbar-search${mobileSearchOpen ? " landing-navbar-search--mobile-open" : ""}`}>
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
                        setMobileSearchOpen(false);
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
                        {product.brand && <span className="landing-navbar-search-result-brand">{product.brand.name}</span>}
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
          <Link href="/preventa-faq" className="landing-navbar-actions-link">FAQ</Link>
          <a className="landing-navbar-actions-link" href="#nosotros" onClick={(e) => { e.preventDefault(); goToSection("nosotros"); }}>Nosotros</a>
          <a className="landing-navbar-actions-link" href="#contacto" onClick={(e) => { e.preventDefault(); goToSection("contacto"); }}>Contacto</a>
          <Link href={customer ? "/cuenta" : "/ingresar"} className="landing-navbar-actions-link">
            {customer ? customer.nombre.split(" ")[0] : "Ingresar"}
          </Link>
          {isStaff && (
            <Link href="/dashboard" className="landing-btn landing-btn-primary">Gestión</Link>
          )}
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

        {/* Solo mobile (ver breakpoint 768px): reemplaza al buscador siempre visible por un ícono
            que lo despliega — el buscador en sí (input + resultados) es el mismo de arriba, no se
            duplica, la CSS mobile lo saca del flujo y lo muestra como una fila propia debajo. */}
        <button
          type="button"
          className="landing-navbar-search-toggle"
          aria-label={mobileSearchOpen ? "Cerrar buscador" : "Abrir buscador"}
          aria-expanded={mobileSearchOpen}
          onClick={() => setMobileSearchOpen((open) => !open)}
        >
          {mobileSearchOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          )}
        </button>
      </div>

      {/* Segunda fila: categorías/ofertas/marcas, como el "menu-top" separado de pontocom.com. */}
      <div className="landing-navbar-categories">
        <div className="landing-container">
          <nav className="landing-navbar-links">
            {categoryTree.map((cat) => {
              const genero = generos[cat.id];
              return (
                <div className="landing-navbar-item" key={cat.id}>
                  <Link href={`/categoria/${cat.slug}`} onClick={() => setMobileMenuOpen(false)}>
                    {cat.name}
                  </Link>
                  {/* Menú completo: subcategorías, género (si la categoría lo tiene) y destacados, más el botón que
                      lleva al catálogo de la categoría. */}
                  <div className="landing-navbar-dropdown">
                    <div className="landing-container landing-navbar-mega">
                      <div className="landing-navbar-mega-cols">
                        {cat.children.length > 0 && (
                          <div className="landing-navbar-mega-col">
                            <p className="landing-navbar-mega-title">Categorías</p>
                            {cat.children.map((sub) => (
                              <Link key={sub.id} href={`/categoria/${sub.slug}`} onClick={() => setMobileMenuOpen(false)}>
                                {sub.name}
                              </Link>
                            ))}
                          </div>
                        )}
                        {genero && (
                          <div className="landing-navbar-mega-col">
                            <p className="landing-navbar-mega-title">Por perfil</p>
                            {genero.opciones.map((op) => (
                              <Link
                                key={op.valor}
                                href={`/categoria/${cat.slug}?attr[${genero.attributeId}]=${encodeURIComponent(op.valor)}`}
                                onClick={() => setMobileMenuOpen(false)}
                              >
                                {op.etiqueta}
                              </Link>
                            ))}
                          </div>
                        )}
                        <div className="landing-navbar-mega-col">
                          <p className="landing-navbar-mega-title">Destacados</p>
                          <Link href={`/categoria/${cat.slug}?orden=recientes`} onClick={() => setMobileMenuOpen(false)}>
                            Nuevos
                          </Link>
                          <Link href={`/categoria/${cat.slug}?descuento=true`} onClick={() => setMobileMenuOpen(false)}>
                            Ofertas
                          </Link>
                        </div>
                      </div>
                      <Link className="landing-navbar-mega-cta" href={`/categoria/${cat.slug}`} onClick={() => setMobileMenuOpen(false)}>
                        Ver todos los {cat.name.toLowerCase()} →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="landing-navbar-item">
              <a className="landing-navbar-ofertas" href="#catalogo" onClick={(e) => e.preventDefault()}>¡¡OFERTAS!!</a>
              {/* Una columna con todas las categorías raíz: una categoría nueva aparece sola. */}
              <div className="landing-navbar-dropdown">
                <div className="landing-container landing-navbar-mega">
                  <div className="landing-navbar-mega-cols">
                    <div className="landing-navbar-mega-col">
                      <p className="landing-navbar-mega-title">Categorías</p>
                      {rootCategories.map((cat) => (
                        <Link key={cat.id} href={`/categoria/${cat.slug}?descuento=true`} onClick={() => setMobileMenuOpen(false)}>
                          {cat.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <Link href="/marcas" onClick={() => setMobileMenuOpen(false)}>Marcas</Link>
            <Link href="/historias" onClick={() => setMobileMenuOpen(false)}>Historias</Link>
          </nav>
        </div>
      </div>
      </header>

      {/* Overlay + drawer del menú mobile, FUERA de <header> a propósito: ese header tiene
          backdrop-filter (ver .landing-navbar), y en iOS/Safari un backdrop-filter en un ancestro
          crea un "containing block" nuevo para sus descendientes position:fixed — el drawer quedaba
          confinado al alto de la barra del navbar en vez de cubrir toda la pantalla. Moviéndolo
          afuera, su position:fixed vuelve a tomar el viewport como referencia en todos los
          navegadores. El div envoltorio solo existe para seguir llevando "landing-navbar--dark" —
          las reglas de tema oscuro del drawer (ver más abajo en globals.css) son todas
          ".landing-navbar--dark .landing-navbar-mobile-*", pensadas para cuando el drawer todavía
          colgaba del <header>; sin este wrapper esas reglas dejarían de aplicar y el drawer se vería
          siempre claro aunque el navbar esté en variant="dark". */}
      {mobileMenuOpen && (
        <div className={isDark ? "landing-navbar--dark" : undefined}>
          <div className="landing-navbar-mobile-overlay" onClick={closeMobileMenu} />
          <nav className="landing-navbar-mobile">
            <div className="landing-navbar-mobile-header">
              {logoSrc ? <img className="landing-navbar-mobile-logo" src={logoSrc} alt={brandName} /> : <span className="landing-navbar-mobile-brand">{brandName}</span>}
              <button type="button" className="landing-navbar-mobile-close" aria-label="Cerrar menú" onClick={closeMobileMenu}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="landing-navbar-mobile-body">
              {categoryTree.map((cat) => {
                const expanded = openMobileGroup === cat.id;
                const genero = generos[cat.id];
                return (
                  <div className="landing-navbar-mobile-group" key={cat.id}>
                    <div className="landing-navbar-mobile-row">
                      <button type="button" className="landing-navbar-mobile-link landing-navbar-mobile-link--toggle" aria-expanded={expanded} onClick={() => toggleMobileGroup(cat.id)}>
                        {cat.name}
                      </button>
                      <button
                        type="button"
                        className={`landing-navbar-mobile-chevron${expanded ? " landing-navbar-mobile-chevron--open" : ""}`}
                        aria-label={expanded ? `Ocultar el menú de ${cat.name}` : `Ver el menú de ${cat.name}`}
                        aria-expanded={expanded}
                        onClick={() => toggleMobileGroup(cat.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                    </div>
                    <div className={`landing-navbar-mobile-collapse${expanded ? " landing-navbar-mobile-collapse--open" : ""}`} aria-hidden={!expanded}>
                      <div className="landing-navbar-mobile-collapse-inner">
                      <div className="landing-navbar-mobile-subgroup">
                        {cat.children.length > 0 && (
                          <>
                            <p className="landing-navbar-mobile-section-title">Categorías</p>
                            {cat.children.map((sub) => (
                              <Link key={sub.id} className="landing-navbar-mobile-sublink" href={`/categoria/${sub.slug}`} onClick={closeMobileMenu}>
                                {sub.name}
                              </Link>
                            ))}
                          </>
                        )}
                        {genero && (
                          <>
                            <p className="landing-navbar-mobile-section-title">Por perfil</p>
                            {genero.opciones.map((op) => (
                              <Link
                                key={op.valor}
                                className="landing-navbar-mobile-sublink"
                                href={`/categoria/${cat.slug}?attr[${genero.attributeId}]=${encodeURIComponent(op.valor)}`}
                                onClick={closeMobileMenu}
                              >
                                {op.etiqueta}
                              </Link>
                            ))}
                          </>
                        )}
                        <p className="landing-navbar-mobile-section-title">Destacados</p>
                        <Link className="landing-navbar-mobile-sublink" href={`/categoria/${cat.slug}?orden=recientes`} onClick={closeMobileMenu}>
                          Nuevos
                        </Link>
                        <Link className="landing-navbar-mobile-sublink" href={`/categoria/${cat.slug}?descuento=true`} onClick={closeMobileMenu}>
                          Ofertas
                        </Link>
                        <Link className="landing-navbar-mobile-cta" href={`/categoria/${cat.slug}`} onClick={closeMobileMenu}>
                          Ver todos los {cat.name.toLowerCase()} →
                        </Link>
                      </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="landing-navbar-mobile-group">
                <div className="landing-navbar-mobile-row">
                  <button type="button" className="landing-navbar-mobile-link landing-navbar-mobile-link--ofertas landing-navbar-mobile-link--toggle" aria-expanded={openMobileGroup === "ofertas"} onClick={() => toggleMobileGroup("ofertas")}>
                    ¡¡OFERTAS!!
                  </button>
                  <button
                    type="button"
                    className={`landing-navbar-mobile-chevron${openMobileGroup === "ofertas" ? " landing-navbar-mobile-chevron--open" : ""}`}
                    aria-label={openMobileGroup === "ofertas" ? "Ocultar categorías en oferta" : "Ver categorías en oferta"}
                    aria-expanded={openMobileGroup === "ofertas"}
                    onClick={() => toggleMobileGroup("ofertas")}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                </div>
                <div className={`landing-navbar-mobile-collapse${openMobileGroup === "ofertas" ? " landing-navbar-mobile-collapse--open" : ""}`} aria-hidden={openMobileGroup !== "ofertas"}>
                  <div className="landing-navbar-mobile-collapse-inner">
                  <div className="landing-navbar-mobile-subgroup">
                    <p className="landing-navbar-mobile-section-title">Categorías</p>
                    {rootCategories.map((cat) => (
                      <Link key={`oferta-${cat.id}`} className="landing-navbar-mobile-sublink" href={`/categoria/${cat.slug}?descuento=true`} onClick={closeMobileMenu}>
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                  </div>
                </div>
              </div>

              <Link className="landing-navbar-mobile-link" href="/marcas" onClick={closeMobileMenu}>Marcas</Link>
              <Link className="landing-navbar-mobile-link" href="/historias" onClick={closeMobileMenu}>Historias</Link>

              <div className="landing-navbar-mobile-divider" />

              <Link className="landing-navbar-mobile-secondary-link" href="/preventa-faq" onClick={closeMobileMenu}>FAQ</Link>
              <a className="landing-navbar-mobile-secondary-link" href="#nosotros" onClick={(e) => { e.preventDefault(); goToSection("nosotros"); }}>Nosotros</a>
              <a className="landing-navbar-mobile-secondary-link" href="#contacto" onClick={(e) => { e.preventDefault(); goToSection("contacto"); }}>Contacto</a>
              <Link className="landing-navbar-mobile-secondary-link" href={customer ? "/cuenta" : "/ingresar"} onClick={closeMobileMenu}>
                {customer ? customer.nombre.split(" ")[0] : "Ingresar"}
              </Link>
              {isStaff && (
                <Link className="landing-navbar-mobile-secondary-link" href="/dashboard" onClick={closeMobileMenu}>Gestión</Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
