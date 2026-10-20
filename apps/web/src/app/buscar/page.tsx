"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "../../lib/api";
import { displayPrice, hasActiveFlash, hasDiscount, isPreventa } from "../../lib/catalog-display";
import type { Page, Product } from "../../lib/types";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { ProductCard } from "../../components/landing/ProductCard";
import { FilterOptionList } from "../../components/landing/FilterOptionList";

type SortBy = "relevancia" | "recientes" | "precio-asc" | "precio-desc" | "nombre-asc";
type PriceRange = [number, number];
type BrandCount = { slug: string; name: string; count: number };

// Mismo criterio que /categoria/[slug]: 4 tarjetas por fila x 5 filas visibles antes de paginar.
const CARDS_PER_PAGE = 20;
// Tope del fetch inicial — a diferencia de /categoria (que re-pide al backend por cada cambio de
// filtro/orden/página, con categoryId fijo), acá los resultados de texto pueden caer en categorías
// distintas entre sí, así que no hay un único "aggregates" de categoría para marca/precio/ofertas.
// En cambio, se trae este set una sola vez por búsqueda y los filtros/orden/paginado se resuelven
// del lado del cliente sobre él (ver hasDiscount/hasActiveFlash/isPreventa en catalog-display.ts,
// pensadas justo para esto) — una búsqueda con más coincidencias que este tope no las vería todas.
const SEARCH_FETCH_LIMIT = 200;

/** "?marca=slug1,slug2" (slug de marca, no id — mucho más legible en la URL, mismo criterio que
 * ?subcategoria= en /categoria), "?descuento=true", "?minPriceBs="/"?maxPriceBs=", "?page=" — se lee
 * directo de window.location.search (no del hook useSearchParams) para no reaccionar a los cambios
 * de URL que este mismo componente genera (ver el efecto que sincroniza estado -> URL más abajo). */
function parseBuscarFiltersFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const minPriceBsRaw = params.get("minPriceBs");
  const maxPriceBsRaw = params.get("maxPriceBs");
  const pageRaw = Math.floor(Number(params.get("page") ?? "1"));
  return {
    brandFilters: (params.get("marca") ?? "").split(",").map((v) => v.trim()).filter(Boolean),
    discountOnly: params.get("descuento") === "true",
    flashOnly: params.get("flash") === "true",
    preventaOnly: params.get("preventa") === "true",
    inStockOnly: params.get("stock") === "true",
    priceApplied:
      minPriceBsRaw !== null || maxPriceBsRaw !== null
        ? ([Number(minPriceBsRaw ?? 0), Number(maxPriceBsRaw ?? 10_000_000)] as PriceRange)
        : null,
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

// useSearchParams (a diferencia de leer window.location.search a mano) es reactivo a los cambios de
// query string entre navegaciones del lado del cliente a esta misma ruta — antes, buscar un segundo
// término desde el navbar (router.push("/buscar?q=...") sin desmontar la página) no disparaba una
// nueva búsqueda porque el efecto de fetch tenía dependencias vacías ([]), solo corría al montar.
function BuscarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") ?? "";

  const [allItems, setAllItems] = useState<Product[] | null>(null);
  const [error, setError] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

  const [brandFilters, setBrandFilters] = useState<string[]>([]);
  const [discountOnly, setDiscountOnly] = useState(false);
  const [flashOnly, setFlashOnly] = useState(false);
  const [preventaOnly, setPreventaOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<PriceRange | null>(null);
  const [priceApplied, setPriceApplied] = useState<PriceRange | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("relevancia");

  useEffect(() => {
    // Filtros + página ya en la URL (?marca=, ?descuento=true, ?minPriceBs=, ?page=, etc.) — llegan
    // así al volver con "atrás" desde /producto/[slug] (ver el efecto de sincronización más abajo) o
    // al entrar por un link ya armado con filtros. Lee window.location.search (no searchParams del
    // hook) a propósito: ver el comentario de parseBuscarFiltersFromSearch.
    const filters = parseBuscarFiltersFromSearch(window.location.search);
    setPageNumber(filters.page);
    setError("");
    setBrandFilters(filters.brandFilters);
    setDiscountOnly(filters.discountOnly);
    setFlashOnly(filters.flashOnly);
    setPreventaOnly(filters.preventaOnly);
    setInStockOnly(filters.inStockOnly);
    setPriceApplied(filters.priceApplied);
    setSortBy("relevancia");
    if (!query.trim()) {
      setAllItems([]);
      setPriceRange(null);
      return;
    }
    setAllItems(null);
    const params = new URLSearchParams({ search: query, pageSize: String(SEARCH_FETCH_LIMIT) });
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then((page) => {
        setAllItems(page.items);
        // Rango del slider calculado acá, junto con el set recién llegado — si quedara en un efecto
        // aparte dependiendo de un `priceBoundsMax` ya derivado, dos búsquedas distintas que dieran la
        // misma cota máxima no dispararían ese efecto de nuevo (mismo valor primitivo) y el slider
        // quedaría pegado al rango de la búsqueda anterior. Arranca en el rango completo (no en
        // filters.priceApplied) aunque ese filtro YA esté aplicado — mismo criterio que /categoria.
        const max = page.items.length > 0 ? Math.ceil(Math.max(...page.items.map((p) => displayPrice(p).bs))) : 0;
        setPriceRange(max > 0 ? [0, max] : null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [query]);

  // Mantiene la URL sincronizada con los filtros/página activos (router.replace, no agrega
  // historial propio) — mismo criterio que CategoriaClient: así "atrás" desde /producto/[slug]
  // restaura la búsqueda tal como había quedado, filtros y página incluidos, en vez de reiniciarla.
  // Esperar a que `allItems` ya esté resuelto (no null) evita una escritura prematura: en el primer
  // render de una URL que YA traía filtros, el estado recién se termina de poblar (ver el efecto de
  // arriba) antes de que el fetch resuelva — sin esta espera, este efecto alcanzaría a pisar la URL
  // con los valores por default de un instante antes.
  useEffect(() => {
    if (allItems === null) return;
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string | null) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };
    setOrDelete("marca", brandFilters.length > 0 ? brandFilters.join(",") : null);
    setOrDelete("descuento", discountOnly ? "true" : null);
    setOrDelete("flash", flashOnly ? "true" : null);
    setOrDelete("preventa", preventaOnly ? "true" : null);
    setOrDelete("stock", inStockOnly ? "true" : null);
    setOrDelete("minPriceBs", priceApplied ? String(priceApplied[0]) : null);
    setOrDelete("maxPriceBs", priceApplied ? String(priceApplied[1]) : null);
    // Página 1 no se escribe (default implícito) — la URL queda limpia salvo que efectivamente se
    // esté parado en otra página.
    setOrDelete("page", pageNumber > 1 ? String(pageNumber) : null);
    const next = params.toString();
    router.replace(next ? `${window.location.pathname}?${next}` : window.location.pathname, { scroll: false });
  }, [allItems, brandFilters, discountOnly, flashOnly, preventaOnly, inStockOnly, priceApplied, pageNumber, router]);

  const priceBoundsMax = useMemo(() => {
    if (!allItems || allItems.length === 0) return 0;
    return Math.ceil(Math.max(...allItems.map((p) => displayPrice(p).bs)));
  }, [allItems]);

  // Conteos/opciones siempre sobre el set COMPLETO de la búsqueda (no sobre `filteredItems`), igual
  // que los aggregates de /categoria: así, p. ej., "En Stock" sigue mostrando cuántos hay aunque ya
  // esté tildado "Con Descuento", en vez de reducirse a medida que se combinan filtros.
  const brandsWithCounts: BrandCount[] = useMemo(() => {
    if (!allItems) return [];
    const counts = new Map<string, BrandCount>();
    for (const product of allItems) {
      if (!product.brand) continue;
      const entry = counts.get(product.brand.slug) ?? { slug: product.brand.slug, name: product.brand.name, count: 0 };
      entry.count += 1;
      counts.set(product.brand.slug, entry);
    }
    return [...counts.values()];
  }, [allItems]);

  const discountCount = useMemo(() => allItems?.filter(hasDiscount).length ?? 0, [allItems]);
  const flashCount = useMemo(() => allItems?.filter(hasActiveFlash).length ?? 0, [allItems]);
  const preventaCount = useMemo(() => allItems?.filter(isPreventa).length ?? 0, [allItems]);
  const inStockCount = useMemo(() => allItems?.filter((p) => p.hasStock).length ?? 0, [allItems]);

  const filteredItems = useMemo(() => {
    if (!allItems) return [];
    let items = allItems;
    if (brandFilters.length > 0) items = items.filter((p) => p.brand && brandFilters.includes(p.brand.slug));
    if (discountOnly) items = items.filter(hasDiscount);
    if (flashOnly) items = items.filter(hasActiveFlash);
    if (preventaOnly) items = items.filter(isPreventa);
    if (inStockOnly) items = items.filter((p) => p.hasStock);
    if (priceApplied) {
      items = items.filter((p) => {
        const bs = displayPrice(p).bs;
        return bs >= priceApplied[0] && bs <= priceApplied[1];
      });
    }
    if (sortBy === "precio-asc" || sortBy === "precio-desc" || sortBy === "nombre-asc") {
      items = [...items].sort((a, b) => {
        if (sortBy === "nombre-asc") return a.name.localeCompare(b.name);
        const diff = displayPrice(a).bs - displayPrice(b).bs;
        return sortBy === "precio-asc" ? diff : -diff;
      });
    }
    // "relevancia"/"recientes": se respeta el orden que ya vino del backend (createdAt desc).
    return items;
  }, [allItems, brandFilters, discountOnly, flashOnly, preventaOnly, inStockOnly, priceApplied, sortBy]);

  function toggleBrand(slug: string) {
    setBrandFilters((prev) => (prev.includes(slug) ? prev.filter((v) => v !== slug) : [...prev, slug]));
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

  function togglePreventaOnly() {
    setPreventaOnly((prev) => !prev);
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
    setPageNumber(1);
  }

  function clearPriceFilter() {
    setPriceApplied(null);
    setPriceRange(priceBoundsMax > 0 ? [0, priceBoundsMax] : null);
    setPageNumber(1);
  }

  function clearAllFilters() {
    setBrandFilters([]);
    setDiscountOnly(false);
    setFlashOnly(false);
    setPreventaOnly(false);
    setInStockOnly(false);
    setPriceRange(priceBoundsMax > 0 ? [0, priceBoundsMax] : null);
    setPriceApplied(null);
    setPageNumber(1);
  }

  const hasActiveFilters =
    discountOnly || flashOnly || preventaOnly || inStockOnly || brandFilters.length > 0 || priceApplied !== null;
  const activeFilterCount =
    (discountOnly ? 1 : 0) +
    (flashOnly ? 1 : 0) +
    (preventaOnly ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    brandFilters.length +
    (priceApplied ? 1 : 0);

  const activeFilterChips: { key: string; label: string; onRemove: () => void }[] = [];
  for (const brandSlug of brandFilters) {
    const brand = brandsWithCounts.find((b) => b.slug === brandSlug);
    if (brand) activeFilterChips.push({ key: `brand-${brandSlug}`, label: brand.name, onRemove: () => toggleBrand(brandSlug) });
  }
  if (inStockOnly) activeFilterChips.push({ key: "stock", label: "En Stock", onRemove: toggleInStockOnly });
  if (discountOnly) activeFilterChips.push({ key: "discount", label: "Con Descuento", onRemove: toggleDiscountOnly });
  if (flashOnly) activeFilterChips.push({ key: "flash", label: "Por tiempo limitado", onRemove: toggleFlashOnly });
  if (preventaOnly) activeFilterChips.push({ key: "preventa", label: "Preventa", onRemove: togglePreventaOnly });
  if (priceApplied) {
    activeFilterChips.push({ key: "price", label: `Bs ${priceApplied[0]} — Bs ${priceApplied[1]}`, onRemove: clearPriceFilter });
  }

  const hasSidebarContent =
    brandsWithCounts.length > 0 || discountCount > 0 || flashCount > 0 || preventaCount > 0 || inStockCount > 0;

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / CARDS_PER_PAGE));
  const currentPage = Math.min(pageNumber, totalPages);
  const pagedProducts = filteredItems.slice((currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE);

  const filterGroups = (
    <div className="landing-filter-groups-box">
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

      {(inStockCount > 0 || inStockOnly || discountCount > 0 || discountOnly || flashCount > 0 || flashOnly || preventaCount > 0 || preventaOnly) && (
        <div className="landing-filter-group">
          <p className="landing-filter-group-title">Ofertas</p>
          {(inStockCount > 0 || inStockOnly) && (
            <label className="landing-filter-checkbox">
              <input type="checkbox" checked={inStockOnly} onChange={toggleInStockOnly} />
              <span className="landing-filter-checkbox-label landing-filter-checkbox-label--stock">En Stock</span>
              <span className="landing-filter-count">{inStockCount}</span>
            </label>
          )}
          {(discountCount > 0 || discountOnly) && (
            <label className="landing-filter-checkbox">
              <input type="checkbox" checked={discountOnly} onChange={toggleDiscountOnly} />
              <span className="landing-filter-checkbox-label">Productos con Descuento</span>
              <span className="landing-filter-count">{discountCount}</span>
            </label>
          )}
          {(flashCount > 0 || flashOnly) && (
            <label className="landing-filter-checkbox">
              <input type="checkbox" checked={flashOnly} onChange={toggleFlashOnly} />
              <span className="landing-filter-checkbox-label landing-filter-checkbox-label--flash">Por tiempo limitado</span>
              <span className="landing-filter-count">{flashCount}</span>
            </label>
          )}
          {(preventaCount > 0 || preventaOnly) && (
            <label className="landing-filter-checkbox">
              <input type="checkbox" checked={preventaOnly} onChange={togglePreventaOnly} />
              <span className="landing-filter-checkbox-label">Preventa</span>
              <span className="landing-filter-count">{preventaCount}</span>
            </label>
          )}
        </div>
      )}

      {brandsWithCounts.length > 0 && (
        <FilterOptionList
          key={`${query}-marca`}
          title="Marca"
          options={brandsWithCounts.map((brand) => ({ value: brand.slug, label: brand.name, count: brand.count }))}
          selected={brandFilters}
          onToggle={toggleBrand}
          variant="scroll"
        />
      )}
    </div>
  );

  return (
    <>
      <div className="landing-breadcrumb-bar">
        <div className="landing-container">
          <p className="landing-breadcrumb">
            <Link href="/home">Inicio</Link>
            <span>/</span>
            <span className="landing-breadcrumb-current">Resultados de búsqueda</span>
          </p>
        </div>
      </div>

      <section className="landing-category-header">
        <div className="landing-container">
          <h1>Resultados de búsqueda</h1>
          <p className="landing-category-lead">
            {query ? `Coincidencias para "${query}".` : "Escribí algo en el buscador del navbar para empezar."}
          </p>
        </div>
      </section>

      <section className="landing-section landing-section--category">
        <div className="landing-container landing-category-layout" id="search-filters-top">
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
              {filterGroups}
            </aside>
          )}

          {activeFilterChips.length > 0 && (
            <div className="landing-active-filters">
              {activeFilterChips.map((chip) => (
                <span className="landing-active-filter-chip" key={chip.key}>
                  {chip.label}
                  <button
                    type="button"
                    className="landing-active-filter-chip-remove"
                    aria-label={`Quitar filtro ${chip.label}`}
                    onClick={chip.onRemove}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="landing-category-main">
            {query && (
              <div className="landing-toolbar">
                {hasSidebarContent && (
                  <button type="button" className="landing-filters-mobile-btn" onClick={() => setFiltersDrawerOpen(true)}>
                    Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                  </button>
                )}
                <p className="landing-toolbar-count">
                  {allItems ? `${filteredItems.length} producto${filteredItems.length === 1 ? "" : "s"}` : ""}
                </p>

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
            )}

            {error && <p className="error-text">{error}</p>}
            {query && !allItems && !error && <p className="landing-empty-note">Buscando...</p>}
            {allItems && query && filteredItems.length === 0 && (
              <p className="landing-empty-note">
                {allItems.length === 0
                  ? `No encontramos productos que coincidan con "${query}".`
                  : "No hay productos para mostrar con estos filtros."}
              </p>
            )}

            {pagedProducts.length > 0 && (
              <>
                <div className="landing-product-grid" id="search-results-grid">
                  {pagedProducts.map((product) => (
                    <ProductCard product={product} key={product.id} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="landing-pagination">
                    <button
                      type="button"
                      className="landing-btn landing-btn-outline-dark"
                      disabled={currentPage <= 1}
                      onClick={() => {
                        setPageNumber(currentPage - 1);
                        document.getElementById("search-filters-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
                        document.getElementById("search-filters-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
              <button type="button" className="landing-filters-drawer-close" aria-label="Cerrar filtros" onClick={() => setFiltersDrawerOpen(false)}>
                ×
              </button>
            </div>
            <div className="landing-filters-drawer-body">{filterGroups}</div>
            <div className="landing-filters-drawer-footer">
              {hasActiveFilters && (
                <button type="button" className="landing-btn landing-btn-outline-dark" onClick={clearAllFilters}>
                  Limpiar
                </button>
              )}
              <button type="button" className="landing-btn landing-btn-primary" onClick={() => setFiltersDrawerOpen(false)}>
                Ver {filteredItems.length} producto{filteredItems.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function BuscarPage() {
  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />
      <Suspense fallback={null}>
        <BuscarContent />
      </Suspense>
      <LandingFooter />
    </div>
  );
}
