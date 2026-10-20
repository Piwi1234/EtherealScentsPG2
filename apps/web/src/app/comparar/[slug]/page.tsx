import { notFound } from "next/navigation";
import { apiGet, ApiError } from "../../../lib/api";
import type { Product, SimilarByAccordsResponse } from "../../../lib/types";
import { CompararClient } from "./CompararClient";

async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    return await apiGet<Product>(`/catalog/products/slug/${slug}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Server Component a propósito (igual que /producto/[slug]): resuelve el producto y sus similares
 * acá para que el primer HTML ya traiga todo — el paginado en sí (con su animación de scroll) vive
 * en CompararClient. */
export default async function CompararPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page } = await searchParams;

  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const similar = await apiGet<SimilarByAccordsResponse>(`/catalog/products/${product.id}/similares`).catch(
    () => ({ accords: [], totalAccords: 0, groups: [] }) satisfies SimilarByAccordsResponse,
  );

  const pageFromQuery = Math.floor(Number(page ?? "1"));
  const initialPageNumber = Number.isFinite(pageFromQuery) && pageFromQuery > 0 ? pageFromQuery : 1;

  return <CompararClient product={product} similar={similar} initialPageNumber={initialPageNumber} />;
}
