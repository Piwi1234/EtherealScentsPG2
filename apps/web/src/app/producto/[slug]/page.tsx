import { notFound } from "next/navigation";
import { apiGet, ApiError } from "../../../lib/api";
import type { Category, Page, Product } from "../../../lib/types";
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

  // "También te puede gustar": los últimos 4 productos agregados de la misma marca, sin contar este.
  // Se pide uno de más (pageSize 5) para poder descartar el actual y aun así completar 4.
  const relatedProducts = product.brand
    ? await apiGet<Page<Product>>(`/catalog/products?brandId=${product.brand.id}&pageSize=5`)
        .then((page) => page.items.filter((p) => p.id !== product.id).slice(0, 4))
        .catch(() => [] as Product[])
    : [];

  return <ProductoDetailClient product={product} categories={categories} relatedProducts={relatedProducts} />;
}
