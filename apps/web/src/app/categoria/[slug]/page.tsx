"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet, ApiError } from "../../../lib/api";
import { getAttributeFilterOptions } from "../../../lib/catalog-display";
import type { Attribute, Category, CategoryAggregates, Page, Product } from "../../../lib/types";
import { LandingNavbar } from "../../../components/landing/LandingNavbar";
import { LandingFooter } from "../../../components/landing/LandingFooter";
import { ImageCarousel } from "../../../components/landing/ImageCarousel";
import { ProductCard } from "../../../components/landing/ProductCard";

type SortBy = "relevancia" | "recientes" | "precio-asc" | "precio-desc" | "nombre-asc";
type BrandCount = { id: string; name: string; count: number };
type PriceRange = [number, number];

const CATEGORY_BANNER_AUTOPLAY_MS = 10000;

const FILTER_VISIBLE_DEFAULT = 10;
// 4 tarjetas por fila x 5 filas visibles — a partir de ahí se pagina.
const CARDS_PER_PAGE = 20;
// Tope de valores simultáneos para un filtro "allowMultiple" (ej. Acordes) — coincide con el límite
// que valida el backend en browse.service.ts, donde el producto debe coincidir con TODOS los
// seleccionados (no con cualquiera).
const MAX_ALLOW_MULTIPLE_FILTER_VALUES = 4;

export default function CategoriaPage() {
  const { slug } = useParams<{ slug: string }>();

  const [category, setCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  // Sin filtro de subcategoría/atributo: de acá salen las opciones de los filtros de atributo tipo
  // MULTI_VALUE/TEXT/NUMBER/BOOLEAN (ver getAttributeFilterOptions) — los SELECT (ej. Acordes) no la
  // necesitan, sus opciones salen directo de filterableAttributes. Los conteos del sidebar
  // (subcategoría/marca/ofertas/precio) NO salen de acá — ver `aggregates`, más abajo: antes salían
  // de esta misma tanda paginada (pageSize=200, recortado a 100 por el backend) y con miles de
  // productos ni de cerca alcanzaba a cubrir todas las marcas que existen.
  const [basePage, setBasePage] = useState<Page<Product> | null>(null);
  // Conteo por subcategoría (para el propio grupo "Subcategoría" del sidebar) — siempre a nivel raíz,
  // independiente de cuál esté marcada, para que se sigan viendo los conteos de las hermanas.
  const [rootSubcategoryCounts, setRootSubcategoryCounts] = useState<Record<string, number>>({});
  // Marca/ofertas/stock/precio del sidebar — a nivel raíz, o de la subcategoría marcada si hay una
  // (ver el efecto de abajo), para que la lista de marcas coincida con lo que se está mostrando.
  const [aggregates, setAggregates] = useState<CategoryAggregates | null>(null);
  // Con categoría (o subcategoría) + atributos ya aplicados server-side: es lo que se muestra.
  const [productsPage, setProductsPage] = useState<Page<Product> | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  const [subCategoryFilter, setSubCategoryFilter] = useState("");
  const [discountOnly, setDiscountOnly] = useState(false);
  const [flashOnly, setFlashOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  // priceRange: posición actual del slider (se ve en vivo). priceApplied: lo que realmente filtra
  // — se actualiza recién al tocar "Filtrar", como en el mock de referencia.
  const [priceRange, setPriceRange] = useState<PriceRange | null>(null);
  const [priceApplied, setPriceApplied] = useState<PriceRange | null>(null);
  const [brandFilters, setBrandFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("relevancia");
  const [pageNumber, setPageNumber] = useState(1);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [priceDropdownOpen, setPriceDropdownOpen] = useState(false);
  const priceDropdownRef = useRef<HTMLDivElement>(null);

  const [filterableAttributes, setFilterableAttributes] = useState<Attribute[]>([]);
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string[]>>({});

  // Bloquea el scroll del fondo mientras el drawer de filtros (mobile) está abierto — si no, al
  // arrastrar con el dedo dentro del drawer (sobre todo si el toque empieza en el header/footer, no
  // en el área con overflow-y:auto) el touch "pasa" y scrollea la página de atrás en vez del drawer
  // (y en iOS Safari, overflow:hidden solo en el body no alcanza: sigue dejando pasar el scroll por
  // "rubber-banding"). position:fixed con el scroll actual guardado en `top` es el fix estándar para
  // iOS, y se restaura el scroll exacto al cerrar — mismo patrón que usa LandingNavbar para su menú.
  useEffect(() => {
    if (!filtersDrawerOpen) return;
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
  }, [filtersDrawerOpen]);

  // Todas las categorías (para armar el breadcrumb y las subcategorías) — la categoría cambia con la ruta.
  useEffect(() => {
    // "?descuento=true" (desplegable de ¡¡OFERTAS!! del navbar), "?subcategoria=" + "?marca="
    // (logo de marca del carrusel "Explora Nuestras Marcas" del home) arrancan sus filtros ya
    // marcados.
    const searchParams = new URLSearchParams(window.location.search);
    const subcategoriaFromQuery = searchParams.get("subcategoria") ?? "";
    const marcaFromQuery = searchParams.get("marca");
    setSubCategoryFilter(subcategoriaFromQuery);
    setDiscountOnly(searchParams.get("descuento") === "true");
    setPriceRange(null);
    setPriceApplied(null);
    setBrandFilters(marcaFromQuery ? [marcaFromQuery] : []);
    setSortBy("relevancia");
    setAttributeFilters({});
    setPageNumber(1);
    setFiltersDrawerOpen(false);
    setNotFound(false);
    setCategory(null);
    // Se resetea acá (y no solo al resolver la categoría nueva) para no mostrar de arranque los
    // filtros de la categoría anterior mientras se resuelve el slug de la URL.
    setFilterableAttributes([]);
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    apiGet<Category>(`/categories/slug/${slug}`)
      .then((cat) => {
        setCategory(cat);
        // Si se entra directo a una subcategoría (ej. desde el desplegable del navbar) y no vino
        // ninguna subcategoría puntual por query, esa subcategoría arranca marcada en el filtro — el
        // grid ya la mostraba igual, esto solo hace que el checkbox y sus hermanas aparezcan.
        if (cat.parentId && !subcategoriaFromQuery) setSubCategoryFilter(cat.id);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : String(e));
      });
  }, [slug]);

  // Separado del efecto de arriba porque necesita el id real de la categoría (recién se conoce
  // después de resolver el slug de la URL), no el slug en sí.
  useEffect(() => {
    if (!category) return;
    apiGet<Attribute[]>(`/catalog/categories/${category.id}/filters`).then(setFilterableAttributes).catch(() => {});
  }, [category?.id]);

  // Categoría raíz "efectiva": si `category` ya es una subcategoría, sus hermanas están bajo su
  // propio padre, no bajo ella misma. De acá salen tanto la lista de subcategorías del sidebar
  // como `basePage` (para que los contadores/rango de precio/marcas cubran todas las hermanas, no
  // solo la actual).
  const effectiveRootId = category ? category.parentId ?? category.id : null;
  // El carrusel del hero es uno solo por categoría raíz (no por subcategoría) — cuando `category`
  // es una subcategoría, se usa el de su padre.
  const rootCategoryForBanner = effectiveRootId ? categories.find((c) => c.id === effectiveRootId) : null;

  useEffect(() => {
    if (!effectiveRootId) return;
    const params = new URLSearchParams();
    params.set("categoryId", effectiveRootId);
    params.set("pageSize", "200");
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then(setBasePage)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    apiGet<CategoryAggregates>(`/catalog/categories/${effectiveRootId}/aggregates`)
      .then((data) => setRootSubcategoryCounts(data.subcategoryCounts))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [effectiveRootId]);

  // Marca/ofertas/stock/precio del sidebar, acotados a la subcategoría marcada cuando hay una — así
  // "Marca" solo ofrece las que realmente tienen productos ahí, no todas las de la categoría raíz.
  useEffect(() => {
    if (!effectiveRootId) return;
    const targetCategoryId = subCategoryFilter || effectiveRootId;
    apiGet<CategoryAggregates>(`/catalog/categories/${targetCategoryId}/aggregates`)
      .then(setAggregates)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [effectiveRootId, subCategoryFilter]);

  // Paginado 100% del lado del servidor — antes se traía como mucho una sola tanda de 100 productos
  // y se paginaba/ordenaba/filtraba por marca y precio en el navegador sobre esos mismos 100, así que
  // una categoría con más de 100 productos (ej. tras un import masivo) nunca mostraba el resto. Ahora
  // cada cambio de página/filtro/orden dispara un fetch nuevo con exactamente lo que hace falta.
  useEffect(() => {
    if (!category) return;
    const params = new URLSearchParams();
    params.set("categoryId", subCategoryFilter || category.id);
    params.set("page", String(pageNumber));
    params.set("pageSize", String(CARDS_PER_PAGE));
    for (const [attributeId, values] of Object.entries(attributeFilters)) {
      if (values.length > 0) params.set(`attr[${attributeId}]`, values.join(","));
    }
    if (discountOnly) params.set("onlyDiscounted", "true");
    if (flashOnly) params.set("onlyFlash", "true");
    if (inStockOnly) params.set("onlyInStock", "true");
    if (brandFilters.length > 0) params.set("brandId", brandFilters.join(","));
    if (priceApplied) {
      params.set("minPriceBs", String(priceApplied[0]));
      params.set("maxPriceBs", String(priceApplied[1]));
    }
    // "relevancia" y "recientes" son el mismo orden por defecto del backend (createdAt desc) — no
    // hace falta mandar el parámetro para esos dos.
    if (sortBy === "precio-asc" || sortBy === "precio-desc" || sortBy === "nombre-asc") {
      params.set("sortBy", sortBy);
    }
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then(setProductsPage)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [
    category,
    subCategoryFilter,
    attributeFilters,
    discountOnly,
    flashOnly,
    inStockOnly,
    brandFilters,
    priceApplied,
    sortBy,
    pageNumber,
  ]);

  // Techo del slider de precio: precio más alto entre los productos de la categoría, ya calculado
  // por el backend (ver getCategoryAggregates) sobre el total real, no sobre una muestra.
  const priceBoundsMax = aggregates?.maxPriceBs ?? 0;

  useEffect(() => {
    if (priceBoundsMax > 0) setPriceRange([0, priceBoundsMax]);
  }, [priceBoundsMax]);

  // Cada handler de filtro vuelve a la página 1 en el mismo evento que cambia el filtro (no en un
  // efecto aparte) — así React junta los dos `setState` en un solo render y el fetch de productos
  // sale una sola vez, ya con la página correcta, en vez de una vez con la página vieja y otra con
  // la 1 apenas se re-renderiza.
  function toggleAttributeValue(attributeId: string, value: string) {
    setAttributeFilters((prev) => {
      const current = prev[attributeId] ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      const updated = { ...prev };
      if (next.length > 0) updated[attributeId] = next;
      else delete updated[attributeId];
      return updated;
    });
    setPageNumber(1);
  }

  function toggleBrand(brandId: string) {
    setBrandFilters((prev) => (prev.includes(brandId) ? prev.filter((v) => v !== brandId) : [...prev, brandId]));
    setPageNumber(1);
  }

  function selectSubcategory(subId: string) {
    setSubCategoryFilter((prev) => (prev === subId ? "" : subId));
    setPageNumber(1);
  }

  function toggleDiscountOnly() {
    setDiscountOnly((prev) => !prev);
    setPageNumber(1);
  }

  function toggleFlashOnly() {
    setFlashOnly((prev) => !prev);
    setPageNumber(1);
  }

  function toggleInStockOnly() {
    setInStockOnly((prev) => !prev);
    setPageNumber(1);
  }

  function handlePriceMinChange(value: number) {
    setPriceRange((prev) => {
      const max = prev ? prev[1] : priceBoundsMax;
      return [Math.min(value, max), max];
    });
  }

  function handlePriceMaxChange(value: number) {
    setPriceRange((prev) => {
      const min = prev ? prev[0] : 0;
      return [min, Math.max(value, min)];
    });
  }

  function applyPriceFilter() {
    if (priceRange) setPriceApplied(priceRange);
    setPriceDropdownOpen(false);
    setPageNumber(1);
  }

  // Cierra el desplegable de precio al hacer click afuera — un listener en el documento en vez de
  // onBlur porque arrastrar el slider no debe cerrarlo a mitad de camino.
  useEffect(() => {
    if (!priceDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (priceDropdownRef.current && !priceDropdownRef.current.contains(e.target as Node)) {
        setPriceDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [priceDropdownOpen]);

  function clearAllFilters() {
    setSubCategoryFilter("");
    setDiscountOnly(false);
    setFlashOnly(false);
    setInStockOnly(false);
    setPriceRange(priceBoundsMax > 0 ? [0, priceBoundsMax] : null);
    setPriceApplied(null);
    setBrandFilters([]);
    setAttributeFilters({});
    setPageNumber(1);
  }

  const hasActiveAttributeFilters = Object.keys(attributeFilters).length > 0;
  const hasActiveFilters =
    hasActiveAttributeFilters ||
    subCategoryFilter !== "" ||
    discountOnly ||
    flashOnly ||
    inStockOnly ||
    brandFilters.length > 0 ||
    priceApplied !== null;
  const activeFilterCount =
    Object.keys(attributeFilters).length +
    (subCategoryFilter ? 1 : 0) +
    (discountOnly ? 1 : 0) +
    (flashOnly ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    brandFilters.length +
    (priceApplied ? 1 : 0);

  const subcategories = categories.filter((c) => c.parentId === effectiveRootId);
  const parentCategory = category?.parentId ? categories.find((c) => c.id === category.parentId) ?? null : null;

  // Estos ya vienen calculados del backend sobre el total real de la categoría (antes se armaban
  // acá mismo contando sobre `basePage.items`, una muestra chica). subcategoryCounts es siempre a
  // nivel raíz (`rootSubcategoryCounts`); el resto sigue a la subcategoría marcada (`aggregates`).
  const subcategoryCounts = rootSubcategoryCounts;
  const discountCount = aggregates?.discountCount ?? 0;
  const flashCount = aggregates?.flashCount ?? 0;
  const inStockCount = aggregates?.inStockCount ?? 0;
  const brandsWithCounts: BrandCount[] = aggregates?.brands ?? [];

  // Marca, precio y orden ya se resuelven en el fetch de arriba (server-side) — acá no queda nada
  // que filtrar/ordenar/paginar de nuevo: `productsPage.items` ya es exactamente la página pedida.
  const totalPages = productsPage ? Math.max(1, Math.ceil(productsPage.total / CARDS_PER_PAGE)) : 1;

  if (notFound) {
    return (
      <div className="landing-page">
        <LandingNavbar variant="dark" overlay={false} />
        <section className="landing-category-banner landing-category-banner--no-overlay">
          <h1>Categoría no encontrada</h1>
          <p className="landing-category-lead">
            No pudimos encontrar esta categoría. <Link href="/home">Volvé al inicio</Link>.
          </p>
        </section>
        <LandingFooter />
      </div>
    );
  }

  const hasSidebarContent =
    subcategories.length > 0 ||
    discountCount > 0 ||
    flashCount > 0 ||
    inStockCount > 0 ||
    brandsWithCounts.length > 0 ||
    filterableAttributes.length > 0;

  const filterGroupsProps = {
    resetKey: slug,
    inStockOnly,
    onToggleInStockOnly: toggleInStockOnly,
    inStockCount,
    discountOnly,
    onToggleDiscountOnly: toggleDiscountOnly,
    discountCount,
    flashOnly,
    onToggleFlashOnly: toggleFlashOnly,
    flashCount,
    subcategories,
    subCategoryFilter,
    onSelectSubcategory: selectSubcategory,
    subcategoryCounts,
    filterableAttributes,
    attributeFilters,
    onToggleAttributeValue: toggleAttributeValue,
    baseItems: basePage?.items ?? [],
    brandsWithCounts,
    brandFilters,
    onToggleBrand: toggleBrand,
  };

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      <section className="landing-category-banner landing-category-banner--no-overlay">
        {rootCategoryForBanner && rootCategoryForBanner.heroCarouselImages.length > 0 && (
          <div className="landing-category-banner-bg">
            <ImageCarousel
              images={rootCategoryForBanner.heroCarouselImages}
              alt=""
              imgClassName="landing-category-banner-bg-image"
              autoplayMs={CATEGORY_BANNER_AUTOPLAY_MS}
            />
          </div>
        )}
        <div className="landing-container">
          <h1>{category?.name ?? "Cargando..."}</h1>
          <p className="landing-category-lead">
            {category?.comentario || `Descubrí nuestra selección de ${(category?.name ?? "").toLowerCase()}, con stock real y precios claros.`}
          </p>
        </div>
      </section>

      <div className="landing-breadcrumb-bar">
        <div className="landing-container">
          <p className="landing-breadcrumb">
            <Link href="/home">Inicio</Link>
            <span>/</span>
            {parentCategory && (
              <>
                <Link href={`/categoria/${parentCategory.slug}`}>{parentCategory.name}</Link>
                <span>/</span>
              </>
            )}
            <span className="landing-breadcrumb-current">{category?.name ?? "..."}</span>
          </p>
        </div>
      </div>

      <section className="landing-section">
        <div className="landing-container landing-category-layout">
          {hasSidebarContent && (
            <aside className="landing-filters-sidebar">
              <div className="landing-filters-sidebar-header">
                <p className="landing-toolbar-filter-label">Filtros</p>
                {hasActiveFilters && (
                  <button type="button" className="landing-filter-clear" onClick={clearAllFilters}>
                    Limpiar
                  </button>
                )}
              </div>
              <FilterGroups {...filterGroupsProps} />
            </aside>
          )}

          <div className="landing-category-main">
            <div className="landing-toolbar">
              {hasSidebarContent && (
                <button type="button" className="landing-filters-mobile-btn" onClick={() => setFiltersDrawerOpen(true)}>
                  Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                </button>
              )}
              <p className="landing-toolbar-count">
                {productsPage ? `${productsPage.total} producto${productsPage.total === 1 ? "" : "s"}` : ""}
              </p>

              {priceBoundsMax > 0 && priceRange && (
                <div className="landing-price-dropdown" ref={priceDropdownRef}>
                  <button
                    type="button"
                    className={`landing-price-dropdown-trigger${priceApplied ? " landing-price-dropdown-trigger--active" : ""}`}
                    onClick={() => setPriceDropdownOpen((open) => !open)}
                  >
                    Precio {priceApplied && <span className="landing-price-dropdown-badge">1</span>}
                    <span className={`landing-price-dropdown-arrow${priceDropdownOpen ? " landing-price-dropdown-arrow--open" : ""}`}>▾</span>
                  </button>

                  {priceDropdownOpen && (
                    <div className="landing-price-dropdown-panel">
                      <div className="landing-price-slider">
                        <div className="landing-price-slider-track">
                          <div
                            className="landing-price-slider-fill"
                            style={{
                              left: `${(priceRange[0] / priceBoundsMax) * 100}%`,
                              right: `${100 - (priceRange[1] / priceBoundsMax) * 100}%`,
                            }}
                          />
                        </div>
                        <input
                          type="range"
                          className="landing-price-slider-input"
                          min={0}
                          max={priceBoundsMax}
                          value={priceRange[0]}
                          onChange={(e) => handlePriceMinChange(Number(e.target.value))}
                          aria-label="Precio mínimo"
                        />
                        <input
                          type="range"
                          className="landing-price-slider-input"
                          min={0}
                          max={priceBoundsMax}
                          value={priceRange[1]}
                          onChange={(e) => handlePriceMaxChange(Number(e.target.value))}
                          aria-label="Precio máximo"
                        />
                      </div>
                      <div className="landing-price-slider-footer">
                        <span className="landing-price-slider-value">
                          Bs {priceRange[0]} — Bs {priceRange[1]}
                        </span>
                        <button
                          type="button"
                          className="landing-btn landing-btn-outline-dark landing-price-slider-btn"
                          onClick={applyPriceFilter}
                          disabled={priceApplied !== null && priceApplied[0] === priceRange[0] && priceApplied[1] === priceRange[1]}
                        >
                          Filtrar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <label className="landing-sort-control">
                <span className="landing-sort-label">Ordenar por:</span>
                <select
                  className="landing-select"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as SortBy);
                    setPageNumber(1);
                  }}
                >
                  <option value="relevancia">Relevancia</option>
                  <option value="recientes">Más recientes</option>
                  <option value="precio-asc">Precio: menor a mayor</option>
                  <option value="precio-desc">Precio: mayor a menor</option>
                  <option value="nombre-asc">Nombre: A-Z</option>
                </select>
              </label>
            </div>

            {error && <p className="error-text">{error}</p>}
            {!productsPage && !error && <p className="landing-empty-note">Cargando...</p>}
            {productsPage && productsPage.total === 0 && (
              <p className="landing-empty-note">No hay productos para mostrar con estos filtros.</p>
            )}

            {productsPage && productsPage.total > 0 && (
              <>
                <div className="landing-product-grid" id="product-grid">
                  {productsPage.items.map((product) => (
                    <ProductCard product={product} key={product.id} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="landing-pagination">
                    <button
                      type="button"
                      className="landing-btn landing-btn-outline-dark"
                      disabled={pageNumber <= 1}
                      onClick={() => {
                        setPageNumber((p) => p - 1);
                        document.getElementById("product-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      ← Anterior
                    </button>
                    <span className="landing-pagination-info">
                      Página {pageNumber} de {totalPages}
                    </span>
                    <button
                      type="button"
                      className="landing-btn landing-btn-outline-dark"
                      disabled={pageNumber >= totalPages}
                      onClick={() => {
                        setPageNumber((p) => p + 1);
                        document.getElementById("product-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {filtersDrawerOpen && (
        <div className="landing-filters-drawer-overlay" onClick={() => setFiltersDrawerOpen(false)}>
          <div className="landing-filters-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="landing-filters-drawer-header">
              <p className="landing-toolbar-filter-label">Filtros</p>
              <button
                type="button"
                className="landing-filters-drawer-close"
                aria-label="Cerrar filtros"
                onClick={() => setFiltersDrawerOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="landing-filters-drawer-body">
              <FilterGroups {...filterGroupsProps} />
            </div>
            <div className="landing-filters-drawer-footer">
              {hasActiveFilters && (
                <button type="button" className="landing-btn landing-btn-outline-dark" onClick={clearAllFilters}>
                  Limpiar
                </button>
              )}
              <button type="button" className="landing-btn landing-btn-primary" onClick={() => setFiltersDrawerOpen(false)}>
                Ver {productsPage?.total ?? 0} producto{(productsPage?.total ?? 0) === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}

      <LandingFooter />
    </div>
  );
}

type FilterGroupsProps = {
  /** Route param de la categoría actual — se usa como `key` de los grupos con buscador propio
   * (Subcategoría/Atributos/Marca) para que su texto de búsqueda y "mostrar más" arranquen frescos
   * al navegar a otra categoría. */
  resetKey: string;
  inStockOnly: boolean;
  onToggleInStockOnly: () => void;
  inStockCount: number;
  discountOnly: boolean;
  onToggleDiscountOnly: () => void;
  discountCount: number;
  flashOnly: boolean;
  onToggleFlashOnly: () => void;
  flashCount: number;
  subcategories: Category[];
  subCategoryFilter: string;
  onSelectSubcategory: (id: string) => void;
  subcategoryCounts: Record<string, number>;
  filterableAttributes: Attribute[];
  attributeFilters: Record<string, string[]>;
  onToggleAttributeValue: (attributeId: string, value: string) => void;
  baseItems: Product[];
  brandsWithCounts: BrandCount[];
  brandFilters: string[];
  onToggleBrand: (id: string) => void;
};

/** Contenido de filtros compartido entre el sidebar (desktop) y el drawer (mobile). Orden: Ofertas,
 * Subcategoría, Marca, Atributos — el de Precio se movió al lado de "Ordenar por" en la barra de
 * herramientas (ver landing-price-dropdown en el render principal), ya no vive acá. Subcategoría/
 * Marca/Atributos están ordenados alfabéticamente; si superan los 10 valores suman un buscador, y
 * Marca/Atributos (variant="scroll") muestran todo dentro de una caja con scroll propio en vez de
 * "Mostrar más/menos" — ver `FilterOptionList`. */
function FilterGroups({
  resetKey,
  inStockOnly,
  onToggleInStockOnly,
  inStockCount,
  discountOnly,
  onToggleDiscountOnly,
  discountCount,
  flashOnly,
  onToggleFlashOnly,
  flashCount,
  subcategories,
  subCategoryFilter,
  onSelectSubcategory,
  subcategoryCounts,
  filterableAttributes,
  attributeFilters,
  onToggleAttributeValue,
  baseItems,
  brandsWithCounts,
  brandFilters,
  onToggleBrand,
}: FilterGroupsProps) {
  return (
    <div className="landing-filter-groups-box">
      {(inStockCount > 0 || inStockOnly || discountCount > 0 || discountOnly || flashCount > 0 || flashOnly) && (
        <div className="landing-filter-group">
          <p className="landing-filter-group-title">Ofertas</p>
          {(inStockCount > 0 || inStockOnly) && (
            <label className="landing-filter-checkbox">
              <input type="checkbox" checked={inStockOnly} onChange={onToggleInStockOnly} />
              <span className="landing-filter-checkbox-label landing-filter-checkbox-label--stock">En Stock</span>
              <span className="landing-filter-count">{inStockCount}</span>
            </label>
          )}
          {(discountCount > 0 || discountOnly) && (
            <label className="landing-filter-checkbox">
              <input type="checkbox" checked={discountOnly} onChange={onToggleDiscountOnly} />
              <span className="landing-filter-checkbox-label">Productos con Descuento</span>
              <span className="landing-filter-count">{discountCount}</span>
            </label>
          )}
          {(flashCount > 0 || flashOnly) && (
            <label className="landing-filter-checkbox">
              <input type="checkbox" checked={flashOnly} onChange={onToggleFlashOnly} />
              <span className="landing-filter-checkbox-label landing-filter-checkbox-label--flash">
                Por tiempo limitado
                <svg viewBox="0 0 24 24">
                  <path
                    fill="#f97316"
                    d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248Z"
                  />
                  <path
                    fill="#fde047"
                    d="M15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.545 3.75 3.75 0 0 1 3.255 3.717Z"
                  />
                </svg>
                <svg viewBox="0 0 24 24">
                  <path
                    fill="#f97316"
                    d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248Z"
                  />
                  <path
                    fill="#fde047"
                    d="M15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.545 3.75 3.75 0 0 1 3.255 3.717Z"
                  />
                </svg>
              </span>
              <span className="landing-filter-count">{flashCount}</span>
            </label>
          )}
        </div>
      )}

      {subcategories.length > 0 && (
        <FilterOptionList
          key={`${resetKey}-subcategoria`}
          title="Subcategoría"
          options={subcategories.map((sub) => ({
            value: sub.id,
            label: sub.name,
            count: subcategoryCounts[sub.id] ?? 0,
          }))}
          selected={subCategoryFilter ? [subCategoryFilter] : []}
          onToggle={onSelectSubcategory}
        />
      )}

      {brandsWithCounts.length > 0 && (
        <FilterOptionList
          key={`${resetKey}-marca`}
          title="Marca"
          options={brandsWithCounts.map((brand) => ({ value: brand.id, label: brand.name, count: brand.count }))}
          selected={brandFilters}
          onToggle={onToggleBrand}
          variant="scroll"
        />
      )}

      {filterableAttributes.map((attribute) => {
        const options = getAttributeFilterOptions(attribute, baseItems);
        if (options.length === 0) return null;
        return (
          <FilterOptionList
            key={`${resetKey}-${attribute.id}`}
            title={attribute.name}
            options={options}
            selected={attributeFilters[attribute.id] ?? []}
            onToggle={(value) => onToggleAttributeValue(attribute.id, value)}
            variant="scroll"
            maxSelected={attribute.allowMultiple ? MAX_ALLOW_MULTIPLE_FILTER_VALUES : undefined}
          />
        );
      })}
    </div>
  );
}

type FilterOption = { value: string; label: string; count?: number; color?: string | null };

/**
 * Lista de checkboxes ordenada alfabéticamente por `label`; si hay más de FILTER_VISIBLE_DEFAULT
 * opciones, suma un buscador interno. Dos formas de ver el resto:
 * - "expand" (Subcategoría, Marca): 10 visibles por defecto + "Mostrar más/menos".
 * - "scroll" (Atributos, ej. Acordes): todas las opciones de una, dentro de una caja con scroll
 *   propio — no empuja el resto del sidebar hacia abajo.
 */
function FilterOptionList({
  title,
  options,
  selected,
  onToggle,
  variant = "expand",
  maxSelected,
}: {
  title: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  variant?: "expand" | "scroll";
  /** Ej. Acordes: no deja tildar una opción nueva una vez alcanzado el tope (las ya tildadas se
   * pueden seguir destildando). */
  maxSelected?: number;
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => [...options].sort((a, b) => a.label.localeCompare(b.label)), [options]);
  const term = search.trim().toLowerCase();
  const filtered = term ? sorted.filter((o) => o.label.toLowerCase().includes(term)) : sorted;
  const needsSearch = sorted.length > FILTER_VISIBLE_DEFAULT;
  const visible =
    variant === "scroll" ? filtered : term || showAll ? filtered : filtered.slice(0, FILTER_VISIBLE_DEFAULT);
  const limitReached = maxSelected !== undefined && selected.length >= maxSelected;

  const list = (
    <>
      {visible.map((option) => {
        const isSelected = selected.includes(option.value);
        const disabled = limitReached && !isSelected;
        return (
          <label
            className={`landing-filter-checkbox${disabled ? " landing-filter-checkbox--disabled" : ""}`}
            key={option.value}
          >
            <input type="checkbox" checked={isSelected} disabled={disabled} onChange={() => onToggle(option.value)} />
            {option.color && <span className="landing-filter-swatch" style={{ background: option.color }} />}
            <span className="landing-filter-checkbox-label">{option.label}</span>
            {option.count !== undefined && <span className="landing-filter-count">{option.count}</span>}
          </label>
        );
      })}
      {visible.length === 0 && (
        <p className="landing-empty-note" style={{ margin: 0, fontSize: 12.5 }}>
          Sin resultados.
        </p>
      )}
    </>
  );

  return (
    <div className="landing-filter-group">
      <p className="landing-filter-group-title">{title}</p>
      {needsSearch && (
        <input
          type="search"
          className="landing-filter-search"
          placeholder={`Buscar ${title.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {variant === "scroll" && needsSearch ? <div className="landing-filter-options-scroll">{list}</div> : list}
      {variant === "expand" && !term && filtered.length > FILTER_VISIBLE_DEFAULT && (
        <button type="button" className="landing-filter-clear" style={{ marginTop: 6 }} onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Mostrar menos" : `Mostrar más (${filtered.length - FILTER_VISIBLE_DEFAULT})`}
        </button>
      )}
      {maxSelected !== undefined && (
        <p className="landing-empty-note" style={{ margin: "6px 0 0", fontSize: 12 }}>
          {limitReached ? `Máximo ${maxSelected} seleccionados.` : `Hasta ${maxSelected} a la vez.`}
        </p>
      )}
    </div>
  );
}
