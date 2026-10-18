import { apiGet, getLandingImages } from "../../lib/api";
import type { Category, Page, Product } from "../../lib/types";
import { HomeClient } from "./HomeClient";

// Server Component a propósito (sin "use client") — trae las imágenes del Hero/Colección de la
// semana ANTES de mandar el HTML, así la URL real de la imagen del Hero (el elemento LCP del sitio,
// ver HomeClient.tsx) ya está en el HTML inicial en vez de aparecer recién después de hidratar y
// pedirla por useEffect. El resto de los datos de la página (categorías, marcas, ofertas, etc.)
// sigue armándose en el cliente como antes — solo esto importaba para el LCP.
//
// El bloque "Descuento y Ofertas" tenía el mismo problema (lo marcó Cloudflare, igual que el Hero):
// arrancaba vacío con un "Cargando..." hasta que categorías → flash/preventa → productos se
// resolvían en cadena en el cliente. Acá se resuelve de entrada el modo/categoría por default
// (Descuentos + primera categoría raíz) — ver InitialOffers en HomeClient.tsx.
export default async function HomePage() {
  const [landingImages, categories] = await Promise.all([
    getLandingImages().catch(() => null),
    apiGet<Category[]>("/categories").catch(() => [] as Category[]),
  ]);

  const defaultCategoryId = categories.find((c) => c.parentId === null)?.id ?? null;

  let hasFlashOffers = false;
  let hasPreventaProducts = false;
  let productsPage: Page<Product> | null = null;

  if (defaultCategoryId) {
    const [flashPage, preventaPage, offersPage] = await Promise.all([
      apiGet<Page<Product>>("/catalog/products?onlyFlash=true&pageSize=1").catch(() => null),
      apiGet<Page<Product>>("/catalog/products?onlyPreventa=true&pageSize=1").catch(() => null),
      apiGet<Page<Product>>(
        `/catalog/products?onlyDiscounted=true&categoryId=${defaultCategoryId}&pageSize=40&sortBy=actualizados`,
      ).catch(() => null),
    ]);
    hasFlashOffers = (flashPage?.total ?? 0) > 0;
    hasPreventaProducts = (preventaPage?.total ?? 0) > 0;
    productsPage = offersPage;
  }

  return (
    <HomeClient
      initialLandingImages={landingImages}
      initialOffers={categories.length > 0 ? { categories, defaultCategoryId, hasFlashOffers, hasPreventaProducts, productsPage } : null}
    />
  );
}
