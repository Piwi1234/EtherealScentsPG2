// Compartido entre page.tsx (Server Component, primer fetch antes de mandar el HTML — ver su
// comentario) y CategoriaClient.tsx (el resto de la interactividad: cambiar de filtro, página,
// orden). Una sola fuente de verdad para "qué filtros trae la URL" y "cómo se arma la query de
// /catalog/products a partir de esos filtros" — si se duplicara en los dos lados, en algún momento
// iban a quedar desalineados entre sí.

export type SortBy = "relevancia" | "recientes" | "precio-asc" | "precio-desc" | "nombre-asc";
export type PriceRange = [number, number];

export type CategoriaFiltersFromUrl = {
  subCategoryFilter: string;
  discountOnly: boolean;
  flashOnly: boolean;
  inStockOnly: boolean;
  priceApplied: PriceRange | null;
  brandFilters: string[];
  attributeFilters: Record<string, string[]>;
};

/** "?subcategoria=", "?descuento=true", "?attr[id]=valor1,valor2", etc. — mismo formato que ya
 * entendía esta página (ver ScentFinder del home, el desplegable ¡¡OFERTAS!! del navbar, y el logo
 * de marca del carrusel "Explora Nuestras Marcas"). */
export function parseCategoriaFiltersFromSearchParams(searchParams: URLSearchParams): CategoriaFiltersFromUrl {
  const attributeFilters: Record<string, string[]> = {};
  for (const [key, value] of searchParams.entries()) {
    const match = key.match(/^attr\[(.+)\]$/);
    if (match) attributeFilters[match[1]] = value.split(",").map((v) => v.trim()).filter(Boolean);
  }
  const marcaFromQuery = searchParams.get("marca");
  const minPriceFromQuery = searchParams.get("minPriceBs");
  const maxPriceFromQuery = searchParams.get("maxPriceBs");

  return {
    subCategoryFilter: searchParams.get("subcategoria") ?? "",
    discountOnly: searchParams.get("descuento") === "true",
    flashOnly: searchParams.get("flash") === "true",
    inStockOnly: searchParams.get("stock") === "true",
    priceApplied:
      minPriceFromQuery !== null || maxPriceFromQuery !== null
        ? [Number(minPriceFromQuery ?? 0), Number(maxPriceFromQuery ?? 10_000_000)]
        : null,
    brandFilters: marcaFromQuery ? marcaFromQuery.split(",").map((v) => v.trim()).filter(Boolean) : [],
    attributeFilters,
  };
}

/** Arma la query de /catalog/products a partir de filtros ya resueltos (no de la URL directamente)
 * — tanto el primer fetch del server (page.tsx) como cada cambio de filtro/página/orden del cliente
 * (CategoriaClient.tsx) terminan en esta misma forma. */
export function buildCategoriaProductsParams(filters: {
  categoryId: string;
  page: number;
  pageSize: number;
  attributeFilters: Record<string, string[]>;
  discountOnly: boolean;
  flashOnly: boolean;
  inStockOnly: boolean;
  brandFilters: string[];
  priceApplied: PriceRange | null;
  sortBy: SortBy;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("categoryId", filters.categoryId);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  for (const [attributeId, values] of Object.entries(filters.attributeFilters)) {
    if (values.length > 0) params.set(`attr[${attributeId}]`, values.join(","));
  }
  if (filters.discountOnly) params.set("onlyDiscounted", "true");
  if (filters.flashOnly) params.set("onlyFlash", "true");
  if (filters.inStockOnly) params.set("onlyInStock", "true");
  if (filters.brandFilters.length > 0) params.set("brandId", filters.brandFilters.join(","));
  if (filters.priceApplied) {
    params.set("minPriceBs", String(filters.priceApplied[0]));
    params.set("maxPriceBs", String(filters.priceApplied[1]));
  }
  // "recientes" es el orden por defecto del backend (createdAt desc) — no hace falta mandar el
  // parámetro para ese. "relevancia" sí se manda: ordena por total histórico vendido, no es lo
  // mismo que el default.
  if (filters.sortBy !== "recientes") params.set("sortBy", filters.sortBy);
  return params;
}
