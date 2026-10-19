import { apiGet, ApiError } from "../../../lib/api";
import { buildCategoriaProductsParams, parseCategoriaFiltersFromSearchParams } from "../../../lib/categoria-query";
import type { Category, Page, Product } from "../../../lib/types";
import { CARDS_PER_PAGE, CategoriaClient } from "./CategoriaClient";

/** Server Component a propósito (ver historias/[slug]/page.tsx, el mismo patrón ya probado) — la
 * primera imagen del grid de productos es el elemento LCP de esta página (lo marcó Cloudflare: el
 * "Resource Load Delay" eran ~2.7s, porque pedirla recién en un useEffect del cliente significaba
 * esperar HTML + JS + hidratación antes de siquiera conocer su URL). Resolviendo la categoría y el
 * primer page de productos acá, con los mismos filtros que ya traiga la URL (?subcategoria=,
 * ?descuento=, ?attr[...]=, etc. — ver parseCategoriaFiltersFromSearchParams), esa URL ya está en el
 * HTML inicial. El resto de la página (sidebar, cambiar de filtro/página/orden) sigue 100% en el
 * cliente, sin tocar — ver el comentario de CategoriaClient. */
export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const rawSearchParams = await searchParams;

  const urlSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearchParams)) {
    if (typeof value === "string") urlSearchParams.set(key, value);
    else if (Array.isArray(value) && value.length > 0) urlSearchParams.set(key, value[0]);
  }

  let category: Category | null = null;
  let notFound = false;
  try {
    category = await apiGet<Category>(`/categories/slug/${slug}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound = true;
  }

  let initialProductsPage: Page<Product> | null = null;
  if (category) {
    const filters = parseCategoriaFiltersFromSearchParams(urlSearchParams);
    const productsParams = buildCategoriaProductsParams({
      categoryId: filters.subCategoryFilter || category.id,
      page: 1,
      pageSize: CARDS_PER_PAGE,
      attributeFilters: filters.attributeFilters,
      discountOnly: filters.discountOnly,
      flashOnly: filters.flashOnly,
      preventaOnly: filters.preventaOnly,
      inStockOnly: filters.inStockOnly,
      brandFilters: filters.brandFilters,
      priceApplied: filters.priceApplied,
      sortBy: "relevancia",
    });
    initialProductsPage = await apiGet<Page<Product>>(`/catalog/products?${productsParams.toString()}`).catch(() => null);
  }

  return <CategoriaClient initialCategory={category} initialNotFound={notFound} initialProductsPage={initialProductsPage} />;
}
