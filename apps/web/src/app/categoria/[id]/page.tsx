"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet, ApiError } from "../../../lib/api";
import { cardImageUrl, displayPrice, getAttributeFilterOptions, hasDiscount, isSoldOut, productImageSrc } from "../../../lib/catalog-display";
import type { Attribute, Category, Page, Product } from "../../../lib/types";
import { LandingNavbar } from "../../../components/landing/LandingNavbar";
import { LandingFooter } from "../../../components/landing/LandingFooter";
import { formatAtributosVisiblesValores } from "../../../components/proformas/AtributosVisibles";

type SortBy = "relevancia" | "recientes" | "precio-asc" | "precio-desc" | "nombre-asc";
type BrandCount = { id: string; name: string; count: number };
type PriceRange = [number, number];

const FILTER_VISIBLE_DEFAULT = 10;
// 4 tarjetas por fila x 5 filas visibles — a partir de ahí se pagina.
const CARDS_PER_PAGE = 20;

export default function CategoriaPage() {
  const { id } = useParams<{ id: string }>();

  const [category, setCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  // Sin filtro de subcategoría/atributo: de acá salen los contadores y rangos del sidebar, para
  // que no cambien de golpe cada vez que se marca un checkbox de otro grupo.
  const [basePage, setBasePage] = useState<Page<Product> | null>(null);
  // Con categoría (o subcategoría) + atributos ya aplicados server-side: es lo que se muestra.
  const [productsPage, setProductsPage] = useState<Page<Product> | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  const [subCategoryFilter, setSubCategoryFilter] = useState("");
  const [discountOnly, setDiscountOnly] = useState(false);
  // priceRange: posición actual del slider (se ve en vivo). priceApplied: lo que realmente filtra
  // — se actualiza recién al tocar "Filtrar", como en el mock de referencia.
  const [priceRange, setPriceRange] = useState<PriceRange | null>(null);
  const [priceApplied, setPriceApplied] = useState<PriceRange | null>(null);
  const [brandFilters, setBrandFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("relevancia");
  const [pageNumber, setPageNumber] = useState(1);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

  const [filterableAttributes, setFilterableAttributes] = useState<Attribute[]>([]);
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string[]>>({});

  // Todas las categorías (para armar el breadcrumb y las subcategorías) — la categoría cambia con la ruta.
  useEffect(() => {
    setSubCategoryFilter("");
    // "?descuento=true" (link desde el desplegable de ¡¡OFERTAS!! del navbar) arranca el filtro de
    // Ofertas ya marcado.
    setDiscountOnly(new URLSearchParams(window.location.search).get("descuento") === "true");
    setPriceRange(null);
    setPriceApplied(null);
    setBrandFilters([]);
    setSortBy("relevancia");
    setAttributeFilters({});
    setFiltersDrawerOpen(false);
    setNotFound(false);
    setCategory(null);
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    apiGet<Attribute[]>(`/catalog/categories/${id}/filters`).then(setFilterableAttributes).catch(() => {});
    apiGet<Category>(`/categories/${id}`)
      .then((cat) => {
        setCategory(cat);
        // Si se entra directo a una subcategoría (ej. desde el desplegable del navbar), esa
        // subcategoría arranca marcada en el filtro — el grid ya la mostraba igual, esto solo
        // hace que el checkbox y sus hermanas aparezcan.
        if (cat.parentId) setSubCategoryFilter(cat.id);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : String(e));
      });
  }, [id]);

  // Categoría raíz "efectiva": si `category` ya es una subcategoría, sus hermanas están bajo su
  // propio padre, no bajo ella misma. De acá salen tanto la lista de subcategorías del sidebar
  // como `basePage` (para que los contadores/rango de precio/marcas cubran todas las hermanas, no
  // solo la actual).
  const effectiveRootId = category ? category.parentId ?? category.id : null;

  useEffect(() => {
    if (!effectiveRootId) return;
    const params = new URLSearchParams();
    params.set("categoryId", effectiveRootId);
    params.set("pageSize", "200");
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then(setBasePage)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [effectiveRootId]);

  useEffect(() => {
    if (!category) return;
    const params = new URLSearchParams();
    params.set("categoryId", subCategoryFilter || category.id);
    params.set("pageSize", "100");
    for (const [attributeId, values] of Object.entries(attributeFilters)) {
      if (values.length > 0) params.set(`attr[${attributeId}]`, values.join(","));
    }
    if (discountOnly) params.set("onlyDiscounted", "true");
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then(setProductsPage)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [category, subCategoryFilter, attributeFilters, discountOnly]);

  // Techo del slider de precio: precio más alto entre los productos de la categoría. Se fija recién
  // cuando se conoce (basePage llega después de category) y solo se resetea si cambia de techo.
  const priceBoundsMax = useMemo(() => {
    const items = basePage?.items ?? [];
    if (items.length === 0) return 0;
    const max = Math.max(...items.map((p) => displayPrice(p).bs));
    return Math.max(10, Math.ceil(max / 10) * 10);
  }, [basePage]);

  useEffect(() => {
    if (priceBoundsMax > 0) setPriceRange([0, priceBoundsMax]);
  }, [priceBoundsMax]);

  function toggleAttributeValue(attributeId: string, value: string) {
    setAttributeFilters((prev) => {
      const current = prev[attributeId] ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      const updated = { ...prev };
      if (next.length > 0) updated[attributeId] = next;
      else delete updated[attributeId];
      return updated;
    });
  }

  function toggleBrand(brandId: string) {
    setBrandFilters((prev) => (prev.includes(brandId) ? prev.filter((v) => v !== brandId) : [...prev, brandId]));
  }

  function selectSubcategory(subId: string) {
    setSubCategoryFilter((prev) => (prev === subId ? "" : subId));
  }

  function toggleDiscountOnly() {
    setDiscountOnly((prev) => !prev);
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
  }

  function clearAllFilters() {
    setSubCategoryFilter("");
    setDiscountOnly(false);
    setPriceRange(priceBoundsMax > 0 ? [0, priceBoundsMax] : null);
    setPriceApplied(null);
    setBrandFilters([]);
    setAttributeFilters({});
  }

  const hasActiveAttributeFilters = Object.keys(attributeFilters).length > 0;
  const hasActiveFilters =
    hasActiveAttributeFilters || subCategoryFilter !== "" || discountOnly || brandFilters.length > 0 || priceApplied !== null;
  const activeFilterCount =
    Object.keys(attributeFilters).length +
    (subCategoryFilter ? 1 : 0) +
    (discountOnly ? 1 : 0) +
    brandFilters.length +
    (priceApplied ? 1 : 0);

  const subcategories = categories.filter((c) => c.parentId === effectiveRootId);
  const parentCategory = category?.parentId ? categories.find((c) => c.id === category.parentId) ?? null : null;

  const subcategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of basePage?.items ?? []) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    return counts;
  }, [basePage]);

  const discountCount = useMemo(() => (basePage?.items ?? []).filter(hasDiscount).length, [basePage]);

  const brandsWithCounts: BrandCount[] = useMemo(() => {
    const byId = new Map<string, BrandCount>();
    for (const p of basePage?.items ?? []) {
      if (!p.brand) continue;
      const current = byId.get(p.brand.id);
      byId.set(p.brand.id, { id: p.brand.id, name: p.brand.name, count: (current?.count ?? 0) + 1 });
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [basePage]);

  const displayedProducts = useMemo(() => {
    if (!productsPage) return [];
    let items = productsPage.items;
    if (brandFilters.length > 0) items = items.filter((p) => p.brand && brandFilters.includes(p.brand.id));
    if (priceApplied) {
      const [min, max] = priceApplied;
      items = items.filter((p) => {
        const price = displayPrice(p).bs;
        return price >= min && price <= max;
      });
    }
    items = [...items];
    if (sortBy === "recientes") items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sortBy === "precio-asc") items.sort((a, b) => displayPrice(a).bs - displayPrice(b).bs);
    else if (sortBy === "precio-desc") items.sort((a, b) => displayPrice(b).bs - displayPrice(a).bs);
    else if (sortBy === "nombre-asc") items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [productsPage, brandFilters, priceApplied, sortBy]);

  // Vuelve a la primera página cada vez que cambia el resultado filtrado/ordenado (si no, se podría
  // quedar en una página que ya no existe para el nuevo resultado).
  useEffect(() => {
    setPageNumber(1);
  }, [displayedProducts]);

  const totalPages = Math.max(1, Math.ceil(displayedProducts.length / CARDS_PER_PAGE));
  const currentPage = Math.min(pageNumber, totalPages);
  const pagedProducts = displayedProducts.slice((currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE);

  if (notFound) {
    return (
      <div className="landing-page">
        <LandingNavbar variant="light" />
        <section className="landing-category-banner">
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
    priceBoundsMax > 0 ||
    brandsWithCounts.length > 0 ||
    filterableAttributes.length > 0;

  const filterGroupsProps = {
    resetKey: id,
    discountOnly,
    onToggleDiscountOnly: toggleDiscountOnly,
    discountCount,
    subcategories,
    subCategoryFilter,
    onSelectSubcategory: selectSubcategory,
    subcategoryCounts,
    filterableAttributes,
    attributeFilters,
    onToggleAttributeValue: toggleAttributeValue,
    baseItems: basePage?.items ?? [],
    priceBoundsMax,
    priceRange,
    onPriceMinChange: handlePriceMinChange,
    onPriceMaxChange: handlePriceMaxChange,
    onApplyPrice: applyPriceFilter,
    priceApplied,
    brandsWithCounts,
    brandFilters,
    onToggleBrand: toggleBrand,
  };

  return (
    <div className="landing-page">
      <LandingNavbar variant="light" />

      <section className="landing-category-banner">
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
                <Link href={`/categoria/${parentCategory.id}`}>{parentCategory.name}</Link>
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
                {productsPage ? `${displayedProducts.length} producto${displayedProducts.length === 1 ? "" : "s"}` : ""}
              </p>
              <label className="landing-sort-control">
                <span className="landing-sort-label">Ordenar por:</span>
                <select
                  className="landing-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
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
            {productsPage && displayedProducts.length === 0 && (
              <p className="landing-empty-note">No hay productos para mostrar con estos filtros.</p>
            )}

            {displayedProducts.length > 0 && (
              <>
                <div className="landing-product-grid" id="product-grid">
                  {pagedProducts.map((product) => {
                    const { bs, fromPrice, variant } = displayPrice(product);
                    const image = productImageSrc(cardImageUrl(product, variant));
                    const atributos = formatAtributosVisiblesValores(product.attributeValues, product.variantOptionValues);
                    return (
                      <Link href={`/producto/${product.id}`} className="landing-product-card" key={product.id}>
                        <div className="landing-product-image-wrap">
                          {image ? (
                            <img className="landing-product-image" src={image} alt={product.name} />
                          ) : (
                            <div className="landing-product-image-placeholder">{product.name.slice(0, 1)}</div>
                          )}
                          {hasDiscount(product) && (
                            <span className="landing-product-offer-badge">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
                                <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
                                <path d="M2.5 3h2.4l2.2 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" />
                              </svg>
                              Oferta
                            </span>
                          )}
                        </div>
                        <div className="landing-product-body">
                          {product.brand && <span className="landing-product-brand">{product.brand.name}</span>}
                          <p className="landing-product-name">{product.name}</p>
                          {atributos && <p className="landing-product-attrs">{atributos}</p>}
                          {isSoldOut(product) ? (
                            <span className="landing-product-soldout-stamp">Sold Out</span>
                          ) : (
                            <span className="landing-product-price">
                              {fromPrice ? "Desde " : ""}Bs {bs.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="landing-pagination">
                    <button
                      type="button"
                      className="landing-btn landing-btn-outline-dark"
                      disabled={currentPage <= 1}
                      onClick={() => {
                        setPageNumber(currentPage - 1);
                        document.getElementById("product-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      ← Anterior
                    </button>
                    <span className="landing-pagination-info">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      type="button"
                      className="landing-btn landing-btn-outline-dark"
                      disabled={currentPage >= totalPages}
                      onClick={() => {
                        setPageNumber(currentPage + 1);
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
                Ver {displayedProducts.length} producto{displayedProducts.length === 1 ? "" : "s"}
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
  discountOnly: boolean;
  onToggleDiscountOnly: () => void;
  discountCount: number;
  subcategories: Category[];
  subCategoryFilter: string;
  onSelectSubcategory: (id: string) => void;
  subcategoryCounts: Map<string, number>;
  filterableAttributes: Attribute[];
  attributeFilters: Record<string, string[]>;
  onToggleAttributeValue: (attributeId: string, value: string) => void;
  baseItems: Product[];
  priceBoundsMax: number;
  priceRange: PriceRange | null;
  onPriceMinChange: (value: number) => void;
  onPriceMaxChange: (value: number) => void;
  onApplyPrice: () => void;
  priceApplied: PriceRange | null;
  brandsWithCounts: BrandCount[];
  brandFilters: string[];
  onToggleBrand: (id: string) => void;
};

/** Contenido de filtros compartido entre el sidebar (desktop) y el drawer (mobile). Orden:
 * Ofertas, Subcategoría, Atributos, Precio, Marca. Subcategoría/Atributos/Marca están ordenados
 * alfabéticamente y, si superan los 10 valores, se comportan como el filtro de Marca (buscador +
 * "Mostrar más/menos") — ver `FilterOptionList`. */
function FilterGroups({
  resetKey,
  discountOnly,
  onToggleDiscountOnly,
  discountCount,
  subcategories,
  subCategoryFilter,
  onSelectSubcategory,
  subcategoryCounts,
  filterableAttributes,
  attributeFilters,
  onToggleAttributeValue,
  baseItems,
  priceBoundsMax,
  priceRange,
  onPriceMinChange,
  onPriceMaxChange,
  onApplyPrice,
  priceApplied,
  brandsWithCounts,
  brandFilters,
  onToggleBrand,
}: FilterGroupsProps) {
  return (
    <>
      {(discountCount > 0 || discountOnly) && (
        <div className="landing-filter-group">
          <p className="landing-filter-group-title">Ofertas</p>
          <label className="landing-filter-checkbox">
            <input type="checkbox" checked={discountOnly} onChange={onToggleDiscountOnly} />
            <span className="landing-filter-checkbox-label">Productos con Descuento</span>
            <span className="landing-filter-count">({discountCount})</span>
          </label>
        </div>
      )}

      {subcategories.length > 0 && (
        <FilterOptionList
          key={`${resetKey}-subcategoria`}
          title="Subcategoría"
          options={subcategories.map((sub) => ({
            value: sub.id,
            label: sub.name,
            count: subcategoryCounts.get(sub.id) ?? 0,
          }))}
          selected={subCategoryFilter ? [subCategoryFilter] : []}
          onToggle={onSelectSubcategory}
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
          />
        );
      })}

      {priceBoundsMax > 0 && priceRange && (
        <div className="landing-filter-group">
          <p className="landing-filter-group-title">Precio</p>
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
              onChange={(e) => onPriceMinChange(Number(e.target.value))}
              aria-label="Precio mínimo"
            />
            <input
              type="range"
              className="landing-price-slider-input"
              min={0}
              max={priceBoundsMax}
              value={priceRange[1]}
              onChange={(e) => onPriceMaxChange(Number(e.target.value))}
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
              onClick={onApplyPrice}
              disabled={priceApplied !== null && priceApplied[0] === priceRange[0] && priceApplied[1] === priceRange[1]}
            >
              Filtrar
            </button>
          </div>
        </div>
      )}

      {brandsWithCounts.length > 0 && (
        <FilterOptionList
          key={`${resetKey}-marca`}
          title="Marca"
          options={brandsWithCounts.map((brand) => ({ value: brand.id, label: brand.name, count: brand.count }))}
          selected={brandFilters}
          onToggle={onToggleBrand}
        />
      )}
    </>
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
}: {
  title: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  variant?: "expand" | "scroll";
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => [...options].sort((a, b) => a.label.localeCompare(b.label)), [options]);
  const term = search.trim().toLowerCase();
  const filtered = term ? sorted.filter((o) => o.label.toLowerCase().includes(term)) : sorted;
  const needsSearch = sorted.length > FILTER_VISIBLE_DEFAULT;
  const visible =
    variant === "scroll" ? filtered : term || showAll ? filtered : filtered.slice(0, FILTER_VISIBLE_DEFAULT);

  const list = (
    <>
      {visible.map((option) => (
        <label className="landing-filter-checkbox" key={option.value}>
          <input type="checkbox" checked={selected.includes(option.value)} onChange={() => onToggle(option.value)} />
          {option.color && <span className="landing-filter-swatch" style={{ background: option.color }} />}
          <span className="landing-filter-checkbox-label">{option.label}</span>
          {option.count !== undefined && <span className="landing-filter-count">({option.count})</span>}
        </label>
      ))}
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
    </div>
  );
}
