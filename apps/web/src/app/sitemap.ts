import type { MetadataRoute } from "next";
import { apiGet } from "../lib/api";
import type { Category, Page, Product } from "../lib/types";

const SITE_ORIGIN = "https://www.etherealscents-bo.com";
const PRODUCTS_PAGE_SIZE = 100;
// Tope de seguridad — a este ritmo cubre 10 000 productos, muy por encima del catálogo real.
const MAX_PRODUCT_PAGES = 100;

async function getAllProducts(): Promise<Product[]> {
  const products: Product[] = [];
  for (let page = 1; page <= MAX_PRODUCT_PAGES; page++) {
    const result = await apiGet<Page<Product>>(`/catalog/products?page=${page}&pageSize=${PRODUCTS_PAGE_SIZE}`);
    products.push(...result.items);
    if (result.items.length < PRODUCTS_PAGE_SIZE) break;
  }
  return products;
}

/**
 * Lista las URLs públicas reales (home, marcas, categorías, productos) para que Google las
 * descubra directo, sin depender solo de los links internos. Si la API no responde, el sitemap
 * queda con las rutas estáticas nomás — no rompe el build (mismo criterio que generateMetadata en
 * layout.tsx).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_ORIGIN}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_ORIGIN}/marcas`, changeFrequency: "weekly", priority: 0.6 },
  ];

  let categories: Category[] = [];
  let products: Product[] = [];
  try {
    [categories, products] = await Promise.all([apiGet<Category[]>("/categories"), getAllProducts()]);
  } catch {
    return staticEntries;
  }

  const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_ORIGIN}/categoria/${c.slug}`,
    changeFrequency: "weekly",
    priority: c.parentId ? 0.6 : 0.7,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_ORIGIN}/producto/${p.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
