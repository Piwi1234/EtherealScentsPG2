import { notFound } from "next/navigation";
import { apiGet, ApiError } from "../../../lib/api";
import type { Category, Product } from "../../../lib/types";
import { ProductoDetailClient } from "./ProductoDetailClient";

/**
 * Server Component a propósito (antes era "use client" con fetch en useEffect): así el producto
 * devuelve un 404 real cuando no existe (notFound(), en vez de una página 200 vacía — lo que
 * Search Console reporta como "Rastreada: actualmente sin indexar"), y el contenido del producto
 * queda en el HTML inicial para que Google lo vea sin tener que ejecutar el JS. El selector de
 * variante/carrito sigue siendo interactivo — ver ProductoDetailClient.
 */
export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let product: Product;
  try {
    product = await apiGet<Product>(`/catalog/products/slug/${slug}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const categories = await apiGet<Category[]>("/categories").catch(() => [] as Category[]);

  return <ProductoDetailClient product={product} categories={categories} />;
}
