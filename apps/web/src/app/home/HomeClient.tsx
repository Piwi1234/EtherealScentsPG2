"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiGet, getBrands, getCasaMatrizLogo, getHistoriaDestacada, getLandingImages } from "../../lib/api";
import { brandLinkHref, offerVariantEntries, productImageSrc } from "../../lib/catalog-display";
import { HISTORIA_CATEGORIA_LABELS, historiaImageSrc, historiaParagraphs, renderHistoriaInline } from "../../lib/historia-display";
import type { Attribute, Brand, CarouselImage, Category, ContactoInfo, HistoriaDetalle, Page, Product } from "../../lib/types";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { ImageCarousel } from "../../components/landing/ImageCarousel";
import { ProductCard } from "../../components/landing/ProductCard";

const OFFERS_SLIDE_SIZE = 5;
const OFFERS_SLIDE_SIZE_MOBILE = 2;
const OFFERS_AUTOPLAY_MS = 7000;
const BRANDS_SLIDE_SIZE = 7;
// En mobile .landing-brand-grid cae a 2 columnas (ver globals.css) — con 7 de siempre eso eran 4
// filas por página; 4 (2 filas parejas) se ve mucho menos alargado.
const BRANDS_SLIDE_SIZE_MOBILE = 4;
const BRANDS_AUTOPLAY_MS = 10000;
// Ciclan por posición dentro de la fila (no por marca) — solo para que la pared de nombres no se
// vea plana, como en la referencia.
const BRAND_CARD_COLORS = ["#4a3f3a", "#39507a", "#8a6a1f", "#5c4a8a", "#7a3f45", "#2f4a63", "#3d6b52", "#8a4a2f"];
const HERO_AUTOPLAY_MS = 10000;
// Mismo breakpoint que usa el navbar para pasar a mobile — abajo de esto el carrusel de ofertas
// pagina de a 2 (en vez de 5). El hero ya muestra 1 sola imagen a cualquier ancho (ver heroWindow).
const MOBILE_BREAKPOINT = "(max-width: 768px)";
const FEATURE_AUTOPLAY_MS = 10000;
const WEEKLY_COLLECTION_BANNER_AUTOPLAY_MS = 10000;
const WEEKLY_COLLECTION_SIZE = 5;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

// "Descuentos" es el modo por default de siempre; "flash" se auto-selecciona al montar si hay
// ofertas flash vigentes (ver el efecto más abajo). "preventa" solo se activa a mano, clickeando su
// pill — nunca es el modo inicial aunque haya productos en preventa.
type OffersMode = "flash" | "discount" | "preventa";

type LandingImages = {
  heroImages: CarouselImage[];
  weeklyCollectionBannerImages: CarouselImage[];
  weeklyCollectionBrand: { id: string; name: string; slug: string; logoUrl: string | null } | null;
};

/** Mismo criterio que `initialLandingImages` (ver más abajo) pero para el bloque "Descuento y
 * Ofertas": también quedaba 100% armado en el cliente (categorías → elegir la primera → recién ahí
 * pedir productos), con un "Cargando..." de por medio en cada visita — ahora page.tsx lo resuelve
 * server-side para el modo/categoría por default (Descuentos + primera categoría raíz) y esto solo
 * se usa para sembrar el estado inicial; cambiar de modo o categoría sigue siendo 100% client-side. */
type InitialOffers = {
  categories: Category[];
  defaultCategoryId: string | null;
  hasFlashOffers: boolean;
  hasPreventaProducts: boolean;
  productsPage: Page<Product> | null;
};

/** La página en sí (page.tsx) es un Server Component que trae esto mismo de entrada y lo pasa acá
 * como prop — la imagen del Hero es el elemento LCP del sitio (lo marcó Cloudflare, ~4s), y pedirla
 * recién en un useEffect del cliente significa esperar HTML + JS + hidratación antes de siquiera
 * conocer su URL. Con la URL real ya en el HTML que manda el servidor, el navegador puede empezar a
 * descargarla en paralelo al JS, sin esperar nada de eso. */
export function HomeClient({
  initialLandingImages,
  initialOffers,
}: {
  initialLandingImages: LandingImages | null;
  initialOffers: InitialOffers | null;
}) {
  // --- Datos: empresa (nombre para textos propios), categorías reales y productos del catálogo público ---
  const [empresa, setEmpresa] = useState<{ nombre: string | null } | null>(null);
  const [categories, setCategories] = useState<Category[]>(initialOffers?.categories ?? []);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categoryFilter, setCategoryFilter] = useState(initialOffers?.defaultCategoryId ?? "");
  const [offersMode, setOffersMode] = useState<OffersMode>("discount");
  // null = todavía no se sabe si hay ofertas flash vigentes (se está consultando al montar). Hasta
  // que se resuelva, el pill "Ofertas Flash" queda oculto y el fetch de productos de abajo espera —
  // así arranca directo en el filtro correcto sin parpadeo.
  const [hasFlashOffers, setHasFlashOffers] = useState<boolean | null>(initialOffers ? initialOffers.hasFlashOffers : null);
  // Mismo criterio que hasFlashOffers, pero el pill "Preventa" nunca se auto-selecciona (ver
  // OffersMode) — solo controla si el pill se muestra o no.
  const [hasPreventaProducts, setHasPreventaProducts] = useState<boolean | null>(
    initialOffers ? initialOffers.hasPreventaProducts : null,
  );
  const [productsPage, setProductsPage] = useState<Page<Product> | null>(initialOffers?.productsPage ?? null);
  // Modo con el que se pidió `productsPage` (no necesariamente el `offersMode` actual: mientras un
  // cambio de modo todavía está en vuelo, los dos quedan desalineados a propósito — ver su uso en
  // offerEntries más abajo, soluciona el salto a "vacío" al cambiar de modo).
  const [productsPageMode, setProductsPageMode] = useState<OffersMode | null>(initialOffers?.productsPage ? "discount" : null);
  const [offersSlide, setOffersSlide] = useState(0);
  const [offersAutoKey, setOffersAutoKey] = useState(0);
  // Transición en curso del carrusel de "Descuento y Ofertas" (cinta deslizante, mismo mecanismo que
  // ImageCarousel — ver goToOffersSlide/finishOffersTransition más abajo). null = en reposo.
  const [offersAnim, setOffersAnim] = useState<{ target: number; dir: 1 | -1 } | null>(null);
  const offersCurrentRef = useRef(0);
  const offersAnimatingRef = useRef(false);
  // Alto medido del bloque (en vez de dejarlo en "auto"): al cambiar de página el contenido real
  // puede variar unos px (ej. countdown de flash presente en una tanda de tarjetas y no en la otra),
  // y sin esto el bloque saltaba de un alto a otro de golpe en el instante en que cambiaba — ahora se
  // mide con scrollHeight después de cada cambio de contenido y se transiciona por CSS (ver
  // .landing-offers-carousel-frame).
  const offersFrameRef = useRef<HTMLDivElement>(null);
  const [offersHeight, setOffersHeight] = useState<number | null>(null);
  // null = todavía no se sabe (ver el layout effect de más abajo) — se trata igual que "sí es
  // mobile" en todo lo que decide CUÁNTOS productos entran por página del carrusel de abajo (ver
  // offersSlideSize): un server no tiene forma de saber el ancho real del dispositivo, así que el
  // primer HTML que manda siempre es el mismo para todos. Asumir "no es mobile" ahí (como antes)
  // hacía que ese primer HTML trajera 5 tarjetas por página aunque el dispositivo fuera angosto — la
  // grilla de 2 columnas de mobile las desbordaba a 3 filas hasta que se corregía, inflando de golpe
  // el alto medido del bloque (ver offersHeight) y dejando las flechas, centradas a la mitad de ese
  // alto, perdidas muy abajo. Asumir mobile de entrada es el default seguro: en mobile de verdad no
  // hay nada que corregir, y en desktop la corrección solo ensancha la misma fila (más columnas, no
  // más filas) — nunca se desborda en ese sentido.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [landingImages, setLandingImages] = useState<LandingImages | null>(initialLandingImages);
  const [weeklyCollectionProducts, setWeeklyCollectionProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [contacto, setContacto] = useState<ContactoInfo | null>(null);
  // null tanto mientras carga como si no hay ninguna historia publicada — el bloque entero queda
  // oculto en los dos casos (ver JSX), así que no hace falta distinguirlos.
  const [historiaDestacada, setHistoriaDestacada] = useState<HistoriaDetalle | null>(null);

  const rootCategories = categories.filter((cat) => cat.parentId === null);
  // "Encuentra tu aroma ideal" (ScentFinder, acá abajo) es específico de Perfumes — Acordes/Concentración
  // no existen para las demás categorías raíz.
  const perfumesCategory = rootCategories.find((cat) => cat.slug === "perfumes") ?? null;

  // Arranca en la primera categoría (según su orden real, ver category.service.ts) apenas cargan —
  // antes había un pill "Todas" que se sacó a pedido, ahora el filtro de categoría de este bloque
  // siempre apunta a una puntual.
  useEffect(() => {
    if (categoryFilter || rootCategories.length === 0) return;
    setCategoryFilter(rootCategories[0].id);
  }, [rootCategories, categoryFilter]);

  useEffect(() => {
    getCasaMatrizLogo().then(setEmpresa).catch(() => {});
    // Las 3 líneas de abajo (categorías, flash, preventa) ya vinieron del servidor junto con el
    // primer page de productos del bloque "Descuento y Ofertas" (ver el comentario de InitialOffers
    // más arriba) — pedirlas de nuevo acá sería un round-trip redundante. Si por algo no vinieron (ver
    // page.tsx), se cae a pedirlas igual que antes.
    if (!initialOffers) {
      apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    }
    getBrands().then(setBrands).catch(() => {});
    // Ya vino del servidor (ver el comentario del componente) — pedirlo de nuevo acá sería un
    // round-trip redundante. Si por algo no vino (ver page.tsx), se cae a pedirlo igual que antes.
    if (!initialLandingImages) getLandingImages().then(setLandingImages).catch(() => {});
    apiGet<ContactoInfo>("/settings/contacto-info").then(setContacto).catch(() => {});
    getHistoriaDestacada().then(setHistoriaDestacada).catch(() => {});

    if (!initialOffers) {
      // "Descuentos" es siempre el default (ver useState más arriba) — a pedido, ya no se auto-
      // selecciona "Ofertas Flash" aunque haya alguna vigente; el pill solo se muestra si hay.
      apiGet<Page<Product>>("/catalog/products?onlyFlash=true&pageSize=1")
        .then((page) => setHasFlashOffers(page.total > 0))
        .catch(() => setHasFlashOffers(false));

      // El pill "Preventa" solo se muestra si hay algo que filtrar — nunca se auto-selecciona.
      apiGet<Page<Product>>("/catalog/products?onlyPreventa=true&pageSize=1")
        .then((page) => setHasPreventaProducts(page.total > 0))
        .catch(() => setHasPreventaProducts(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esta página arma la mayoría de su contenido con fetches async (categorías, marcas, etc.) — el
  // loop de "Producto destacado" por categoría es el que más alto agrega, y ni bien se monta el
  // componente todavía no existe. Dos problemas vienen de ahí, los dos resueltos esperando a que el
  // alto de la página deje de cambiar (layout ya estable) antes de tocar el scroll a mano — genérico
  // a propósito, así no hay que listar cada fetch de la página acá:
  //
  // 1. Con un hash en la URL (ej. desde "Nosotros"/"Contacto" del navbar en otra página — ver
  //    goToSection en LandingNavbar, que hace router.push("/home#id") cuando la sección no existe en
  //    la página actual), el navegador intenta scrollear al id apenas pinta la página, con el salto
  //    corto — y a medida que los bloques de arriba se van agregando, todo se corre hacia abajo sin
  //    que el scroll se reacomode, dejando a la vista lo que haya quedado en esa altura (ej.
  //    "Colección de la semana").
  //
  // 2. Sin hash (ej. volviendo con el botón "Atrás" del navegador después de entrar a Marcas o
  //    Productos desde acá): el navegador intenta restaurar el scroll donde estaba antes de salir,
  //    pero en ese momento la página recién montada es mucho más corta que su alto final (todavía sin
  //    los fetches resueltos) — la restauración queda pegada contra el fondo de esa página corta, y
  //    como el browser no vuelve a intentarlo más tarde, se queda ahí aunque la página siga creciendo.
  //    Se fuerza a mano de vuelta al tope una vez que el layout ya está estable, para no quedar
  //    pegado al final en vez de mostrar el hero.
  useEffect(() => {
    const hash = window.location.hash.slice(1);

    let lastHeight = -1;
    let stableChecks = 0;
    const start = Date.now();

    const interval = setInterval(() => {
      const height = document.body.scrollHeight;
      if (height === lastHeight) {
        stableChecks += 1;
      } else {
        stableChecks = 0;
        lastHeight = height;
      }
      // 2 chequeos seguidos (300ms) sin cambios de alto, o un tope de 5s por si algo nunca termina
      // de asentarse — lo que pase primero.
      if (stableChecks >= 2 || Date.now() - start > 5000) {
        clearInterval(interval);
        if (hash) {
          document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.scrollTo(0, 0);
        }
      }
    }, 150);

    return () => clearInterval(interval);
  }, []);

  // Ver InitialOffers más arriba: page.tsx ya trajo el primer page de productos (modo "Descuentos" +
  // primera categoría), así que la primera corrida del efecto de abajo sería un fetch redundante.
  const skipInitialOffersFetch = useRef(Boolean(initialOffers?.productsPage));

  // Carrusel de "Descuento y Ofertas": últimos 40 productos con descuento/flash/preventa (por fecha
  // de última modificación) de la categoría elegida, de 5 en 5. Modo (1ra fila) y categoría (2da
  // fila) se combinan siempre — ninguno de los tres modos es exclusivo de todas las categorías
  // juntas, también se pueden acotar a una.
  useEffect(() => {
    // Esperar a saber si hay ofertas flash (ver arriba) y a que se resuelva la categoría por defecto
    // (ver el efecto de arriba) antes de disparar el fetch real — si no, arrancaría sin categoría y a
    // los pocos ms saltaría a la primera, con doble fetch y salto visual.
    if (hasFlashOffers === null || !categoryFilter) return;

    if (skipInitialOffersFetch.current) {
      skipInitialOffersFetch.current = false;
      return;
    }

    // Se guarda el modo pedido en esta misma corrida del efecto (no el `offersMode` "en vivo" de más
    // arriba) — mientras este fetch todavía está en vuelo, `productsPage` sigue teniendo los items del
    // modo ANTERIOR. Ej.: Descuentos → Preventa, ningún item de Descuentos es de Preventa (son
    // mutuamente excluyentes, ver variantMatchesContext), así que filtrarlos ya con offersMode =
    // "preventa" los vaciaba a todos de golpe — el bloque se achicaba a "vacío" y volvía a crecer
    // apenas llegaba la respuesta real. Ver su uso en offerEntries.
    const requestedMode = offersMode;

    const params = new URLSearchParams();
    if (requestedMode === "flash") params.set("onlyFlash", "true");
    else if (requestedMode === "preventa") params.set("onlyPreventa", "true");
    else params.set("onlyDiscounted", "true");
    params.set("categoryId", categoryFilter);
    params.set("pageSize", "40");
    params.set("sortBy", "actualizados");
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then((page) => {
        setProductsPage(page);
        setProductsPageMode(requestedMode);
        offersCurrentRef.current = 0;
        offersAnimatingRef.current = false;
        setOffersSlide(0);
        setOffersAnim(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [categoryFilter, offersMode, hasFlashOffers]);

  // En mobile pagina de a 2 productos en vez de 5 (ver el layout effect de matchMedia más abajo).
  // `=== false` a propósito, no solo `isMobile ?` — ver el comentario del useState de isMobile: null
  // (todavía no se sabe) tiene que caer del lado mobile/seguro, no del lado desktop.
  const offersSlideSize = isMobile === false ? OFFERS_SLIDE_SIZE : OFFERS_SLIDE_SIZE_MOBILE;
  // Una tarjeta por cada VARIANTE que calificó para el modo activo (no una por producto) — así un
  // producto con dos tamaños en oferta sale dos veces, una por cada uno (ver offerVariantEntries).
  const offerEntries = useMemo(
    // `productsPageMode` (no `offersMode`) a propósito — ver el comentario del fetch de arriba.
    () => offerVariantEntries(productsPage?.items ?? [], productsPageMode ?? offersMode),
    [productsPage, productsPageMode, offersMode],
  );
  const offersChunks = useMemo(() => chunk(offerEntries, offersSlideSize), [offerEntries, offersSlideSize]);

  // Link del botón "Ver más": la página de la categoría elegida arriba (1ra fila de pills), con el
  // mismo modo de oferta activo (Descuentos/Ofertas Flash/Preventa) ya marcado como filtro — mismo
  // parámetro de URL que entiende CategoriaClient (ver categoria-query.ts).
  const offersCategorySlug = rootCategories.find((cat) => cat.id === categoryFilter)?.slug ?? null;
  const offersModeParam = offersMode === "flash" ? "flash" : offersMode === "preventa" ? "preventa" : "descuento";
  const offersViewMoreHref = offersCategorySlug ? `/categoria/${offersCategorySlug}?${offersModeParam}=true` : null;

  // "Colección de la semana": los últimos 5 productos creados de la marca elegida en Marcas del
  // panel de gestión — bloque oculto si no hay ninguna marca elegida. Sin sortBy: el mismo orden por
  // defecto del backend (createdAt desc) ya es "los más nuevos primero".
  const weeklyCollectionBrandId = landingImages?.weeklyCollectionBrand?.id ?? null;
  useEffect(() => {
    if (!weeklyCollectionBrandId) {
      setWeeklyCollectionProducts([]);
      return;
    }
    const params = new URLSearchParams({ brandId: weeklyCollectionBrandId, pageSize: String(WEEKLY_COLLECTION_SIZE) });
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then((page) => setWeeklyCollectionProducts(page.items))
      .catch(() => {});
  }, [weeklyCollectionBrandId]);

  // Link del botón "Ver más": la página de categoría filtrada por esta marca (mismo mecanismo que
  // brandLinkHref usa para el carrusel "Explorá Nuestras Marcas" de acá abajo) — acá hay que resolver
  // la categoría raíz a mano porque este bloque no vive dentro de un loop por categoría como ese.
  const weeklyCollectionBrandFull = brands.find((b) => b.id === weeklyCollectionBrandId) ?? null;
  const weeklyCollectionBrandCategory = weeklyCollectionBrandFull?.categories[0]?.category ?? null;
  const weeklyCollectionRootCategory = weeklyCollectionBrandCategory
    ? weeklyCollectionBrandCategory.parentId
      ? (categories.find((c) => c.id === weeklyCollectionBrandCategory.parentId) ?? null)
      : weeklyCollectionBrandCategory
    : null;
  const weeklyCollectionHref =
    weeklyCollectionBrandFull && weeklyCollectionRootCategory
      ? brandLinkHref(weeklyCollectionRootCategory, weeklyCollectionBrandFull)
      : null;

  // Avanza sola cada 7s; se reinicia cuando el usuario navega a mano (offersAutoKey) para no
  // "pelear" con un click reciente.
  useEffect(() => {
    if (offersChunks.length <= 1) return;
    const timer = setInterval(() => {
      if (offersAnimatingRef.current) return;
      goToOffersSlide(offersCurrentRef.current + 1, 1);
    }, OFFERS_AUTOPLAY_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offersChunks.length, offersAutoKey]);

  function goToOffersSlide(index: number, dir: 1 | -1) {
    const total = offersChunks.length;
    if (total === 0 || offersAnimatingRef.current) return;
    const from = offersCurrentRef.current;
    const target = ((index % total) + total) % total;
    if (target === from) return;
    offersAnimatingRef.current = true;
    setOffersAnim({ target, dir });
    setOffersAutoKey((k) => k + 1);
  }

  function finishOffersTransition(target: number) {
    offersCurrentRef.current = target;
    offersAnimatingRef.current = false;
    setOffersSlide(target);
    setOffersAnim(null);
  }

  useLayoutEffect(() => {
    const el = offersFrameRef.current;
    if (!el) return;
    setOffersHeight(el.scrollHeight);
  }, [offersChunks, offersSlide, offersAnim, isMobile]);

  function renderOffersWindow(index: number) {
    const chunk = offersChunks[index] ?? [];
    return (
      <div className="landing-product-grid landing-product-grid--carousel">
        {chunk.map(({ product, variant }) => (
          <ProductCard
            product={product}
            forcedVariant={variant}
            flashVariant="boxes"
            context={offersMode}
            key={`${product.id}-${variant.id}`}
          />
        ))}
      </div>
    );
  }

  // En mobile el hero muestra 1 sola imagen por vez (en vez de 3 lado a lado) y el carrusel de
  // ofertas pagina de a 2 (en vez de 5) — ninguno de los dos cambia en PC.
  //
  // useLayoutEffect a propósito (no useEffect): confirma isMobile en el mismo paso síncrono que la
  // hidratación, antes de que el navegador pinte algo nuevo — con un useEffect (efecto "pasivo") esa
  // confirmación podía demorar uno o más frames reales después de hidratar, y en celulares lentos eso
  // alcanzaba a pintarse. El default seguro mientras tanto (ver el useState de isMobile, null en vez
  // de false) ya evita el peor caso de ese instante — acá solo se achica la ventana.
  useLayoutEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT);
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Hero: una sola imagen a pantalla completa por vez (antes eran 3 banners lado a lado) — ahora usa
  // el mismo ImageCarousel compartido del resto del sitio (flechas en los costados + autoplay +
  // swipe táctil en mobile, en vez de reimplementar todo ese mecanismo acá).
  const heroImages = landingImages?.heroImages ?? [];

  const brandName = empresa?.nombre ?? "Ethereal Scents";

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      {/* ============ 2. Hero: una imagen a pantalla completa ============ */}
      {heroImages.length > 0 && (
        <section className="landing-hero-banners">
          <div className="landing-hero-banner-frame">
            <ImageCarousel images={heroImages} alt="" imgClassName="landing-hero-banner-image" autoplayMs={HERO_AUTOPLAY_MS} />
          </div>
        </section>
      )}

      {/* ================= 2b. Confianza ================= */}
      <section className="landing-trust-bar">
        <div className="landing-container landing-trust-bar-grid">
          <div className="landing-trust-item">
            <span className="landing-trust-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 5 6v5c0 4.5 3 8.4 7 9.9 4-1.5 7-5.4 7-9.9V6l-7-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <div>
              <p className="landing-trust-title">100% originales</p>
              <p className="landing-trust-subtitle">Con garantía de autenticidad</p>
            </div>
          </div>

          <div className="landing-trust-item">
            <span className="landing-trust-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7h11v9H3z" />
                <path d="M14 10h4l3 3v3h-7z" />
                <circle cx="7.5" cy="18" r="1.6" />
                <circle cx="17.5" cy="18" r="1.6" />
              </svg>
            </span>
            <div>
              <p className="landing-trust-title">Envío a todo el país</p>
              <p className="landing-trust-subtitle">Envío gratuito en compras a partir de 1.000 Bs</p>
            </div>
          </div>

          <div className="landing-trust-item">
            <span className="landing-trust-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.2" />
                <rect x="14" y="3" width="7" height="7" rx="1.2" />
                <rect x="3" y="14" width="7" height="7" rx="1.2" />
                <rect x="14" y="14" width="3" height="3" rx="0.6" />
                <rect x="18" y="14" width="3" height="3" rx="0.6" />
                <rect x="14" y="18" width="3" height="3" rx="0.6" />
                <rect x="18" y="18" width="3" height="3" rx="0.6" />
              </svg>
            </span>
            <div>
              <p className="landing-trust-title">Pago por QR</p>
              <p className="landing-trust-subtitle">O transferencia bancaria</p>
            </div>
          </div>

          <div className="landing-trust-item">
            <span className="landing-trust-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3C7 3 3 6.6 3 11c0 2.1 1 4 2.6 5.4L5 21l4.8-1.9c.7.2 1.4.3 2.2.3 5 0 9-3.6 9-8S17 3 12 3Z" />
                <circle cx="8.5" cy="11" r="0.9" fill="currentColor" stroke="none" />
                <circle cx="12" cy="11" r="0.9" fill="currentColor" stroke="none" />
                <circle cx="15.5" cy="11" r="0.9" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <div>
              <p className="landing-trust-title">Asesoría por WhatsApp</p>
              <p className="landing-trust-subtitle">Te ayudamos a elegir</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 3. Descuento y Ofertas ================= */}
      <section id="catalogo" className="landing-section landing-section--offers-dark">
        <div className="landing-container">
          <p className="landing-eyebrow">Catálogo</p>
          <h2 className="landing-section-title">Descuento y Ofertas</h2>
          <p className="landing-section-lead">Los últimos productos en oferta — filtrá por categoría.</p>

          {/* 1ra fila: modo (Ofertas Flash = temporizador vigente / Descuentos = precio rebajado /
              Preventa = variantes en preventa, excluidas de las otras dos aunque tengan descuento o
              temporizador — ver onlyPreventa en browse.service.ts) — independiente de la categoría,
              que se elige aparte en la 2da fila de acá abajo. */}
          <div className="landing-filter-pills landing-filter-pills--row1">
            <button
              type="button"
              className={`landing-pill${offersMode === "discount" ? " landing-pill-active" : ""}`}
              onClick={() => setOffersMode("discount")}
            >
              Descuentos
            </button>
            {hasFlashOffers && (
              <button
                type="button"
                className={`landing-pill landing-pill-flash${offersMode === "flash" ? " landing-pill-flash-active" : ""}`}
                onClick={() => setOffersMode("flash")}
              >
                Ofertas Flash
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2 3 14h6.5l-1.5 8L21 10h-6.5L13 2Z" />
                </svg>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2 3 14h6.5l-1.5 8L21 10h-6.5L13 2Z" />
                </svg>
              </button>
            )}
            {hasPreventaProducts && (
              <button
                type="button"
                className={`landing-pill${offersMode === "preventa" ? " landing-pill-active" : ""}`}
                onClick={() => setOffersMode("preventa")}
              >
                Preventa
              </button>
            )}
          </div>

          {/* 2da fila: categoría — se aplica dentro del modo elegido arriba, no lo reemplaza. */}
          <div className="landing-filter-pills">
            {rootCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`landing-pill${categoryFilter === cat.id ? " landing-pill-active" : ""}`}
                onClick={() => setCategoryFilter(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {error && <p className="error-text">{error}</p>}
          {!productsPage && !error && <p className="landing-empty-note">Cargando...</p>}
          {productsPage && productsPage.items.length === 0 && (
            <div className="landing-offers-empty">
              <p className="landing-offers-empty-text">
                {offersMode === "preventa" ? "No hay productos en preventa por el momento." : "No hay productos en oferta por el momento."}
              </p>
              <a
                className="landing-offers-empty-link"
                href={contacto?.canalOfertasUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Unite al canal de ofertas →
              </a>
            </div>
          )}

          {offersChunks.length > 0 && (
            <div className="landing-carousel">
              <button
                type="button"
                className="landing-carousel-arrow landing-carousel-arrow--prev"
                aria-label="Ofertas anteriores"
                onClick={() => goToOffersSlide(offersSlide - 1, -1)}
                disabled={offersChunks.length <= 1}
              >
                ‹
              </button>

              <div
                className="landing-offers-carousel-frame"
                ref={offersFrameRef}
                style={offersHeight != null ? { height: offersHeight } : undefined}
              >
                {offersAnim ? (
                  <div
                    key={`${offersAnim.target}-${offersAnim.dir}`}
                    className={`landing-offers-track landing-image-carousel-track--${
                      offersAnim.dir === 1 ? "next" : "prev"
                    }`}
                    onAnimationEnd={() => finishOffersTransition(offersAnim.target)}
                  >
                    <div className="landing-offers-pane">
                      {renderOffersWindow(offersAnim.dir === 1 ? offersSlide : offersAnim.target)}
                    </div>
                    <div className="landing-offers-pane">
                      {renderOffersWindow(offersAnim.dir === 1 ? offersAnim.target : offersSlide)}
                    </div>
                  </div>
                ) : (
                  renderOffersWindow(offersSlide)
                )}
              </div>

              <button
                type="button"
                className="landing-carousel-arrow landing-carousel-arrow--next"
                aria-label="Siguientes ofertas"
                onClick={() => goToOffersSlide(offersSlide + 1, 1)}
                disabled={offersChunks.length <= 1}
              >
                ›
              </button>
            </div>
          )}

          {offersChunks.length > 0 && (
            <div className="landing-offers-channel-cta">
              {offersViewMoreHref && (
                <Link className="landing-offers-channel-btn" href={offersViewMoreHref}>
                  Ver más
                </Link>
              )}
              <a
                className="landing-offers-channel-btn"
                href={contacto?.canalOfertasUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Unirte al canal de ofertas
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ================= 3b. Colección de la semana ================= */}
      {landingImages?.weeklyCollectionBrand && weeklyCollectionProducts.length > 0 && (
        <section className="landing-section landing-section-alt">
          <div className="landing-container">
            <p className="landing-eyebrow">Colección de la semana</p>
            <h2 className="landing-section-title landing-weekly-collection-title">
              {landingImages.weeklyCollectionBrand.name}
            </h2>
            <p className="landing-section-lead">
              Lo último de {landingImages.weeklyCollectionBrand.name}, recién llegado a nuestro catálogo.
            </p>

            <div className="landing-weekly-collection-layout">
              {landingImages.weeklyCollectionBannerImages.length > 0 && (
                <div className="landing-weekly-collection-banner">
                  <ImageCarousel
                    images={landingImages.weeklyCollectionBannerImages}
                    alt=""
                    imgClassName="landing-weekly-collection-banner-image"
                    autoplayMs={WEEKLY_COLLECTION_BANNER_AUTOPLAY_MS}
                  />
                </div>
              )}

              <div className="landing-product-grid landing-product-grid--weekly">
                {weeklyCollectionProducts.map((product) => (
                  <ProductCard product={product} key={product.id} />
                ))}
              </div>

              {weeklyCollectionHref && (
                <div className="landing-weekly-collection-more">
                  <Link href={weeklyCollectionHref} className="landing-btn landing-btn-outline-dark">
                    Ver más
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ================= 3c. Explora Nuestras Marcas ================= */}
      <BrandsShowcase rootCategories={rootCategories} brands={brands} />

      {/* ================= 3d. Encuentra tu aroma ideal ================= */}
      {perfumesCategory && (
        <ScentFinder category={perfumesCategory} subcategories={categories.filter((c) => c.parentId === perfumesCategory.id)} />
      )}

      {/* ================= 3d-2. Última historia ================= */}
      {historiaDestacada && (() => {
        const portada = historiaDestacada.bloques.find((b) => b.orden === 0) ?? historiaDestacada.bloques[0];
        // La imagen propia del home gana si está cargada (ver HistoriaHomeImageEditor); si no, cae a
        // la de la portada, como antes de ese campo. La variante mobile sigue el mismo criterio —
        // ojo que si hay imagen de home pero no mobile propia, NO cae a la mobile de la portada (es
        // un recorte pensado para ese otro bloque, no para este).
        const imgUrl = historiaImageSrc(historiaDestacada.homeImageUrl ?? portada?.imageUrl ?? null);
        const mobileImgUrl = historiaImageSrc(
          historiaDestacada.homeMobileImageUrl ?? (historiaDestacada.homeImageUrl ? null : (portada?.mobileImageUrl ?? null)),
        );
        const paragraphs = historiaParagraphs(portada?.texto4 ?? null);
        return (
          <section className="landing-section">
            <div className="landing-container">
              <div className="landing-historia-split landing-historia-promo">
                <div className="landing-historia-split-text">
                  <p className="landing-historia-eyebrow">
                    <span className="landing-historia-eyebrow-label">ÚLTIMA HISTORIA</span>
                    <span className="landing-historia-eyebrow-sep">——</span>
                    <span className="landing-historia-eyebrow-meta">
                      {historiaDestacada.categorias.map((c) => HISTORIA_CATEGORIA_LABELS[c.categoria]).join(" · ")}
                    </span>
                  </p>
                  <h2 className="landing-historia-title">{portada?.texto1 || historiaDestacada.titulo}</h2>
                  {portada?.texto2 && <p className="landing-historia-name">{portada.texto2}</p>}
                  {portada?.texto3 && <p className="landing-historia-tagline">{portada.texto3}</p>}
                  {paragraphs.length > 0 && (
                    <div className="landing-historia-body">
                      <p>{renderHistoriaInline(paragraphs[0])}</p>
                    </div>
                  )}
                  <div className="landing-historia-promo-ctas">
                    <Link href={`/historias/${historiaDestacada.slug}`} className="landing-btn landing-btn-primary">
                      Leer la historia
                    </Link>
                    <Link href="/historias" className="landing-historia-text-link">
                      Ver todas las historias →
                    </Link>
                  </div>
                </div>
                <div className="landing-historia-split-image-wrap">
                  {imgUrl &&
                    (mobileImgUrl ? (
                      <picture>
                        <source media="(max-width: 900px)" srcSet={mobileImgUrl} />
                        <img className="landing-historia-split-image" src={imgUrl} alt={historiaDestacada.titulo} />
                      </picture>
                    ) : (
                      <img className="landing-historia-split-image" src={imgUrl} alt={historiaDestacada.titulo} />
                    ))}
                  <div className="landing-historia-split-fade" />
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ========== 4. Producto destacado: banner con título superpuesto (alterna fondo) ========== */}
      {rootCategories.map((cat, i) => {
        // Fondo negro (Black Steel) para el primer bloque, papel para el siguiente, y así alterna —
        // .landing-feature-block--dark/--light ajustan el color de letras/tema para cada caso.
        const isDark = i % 2 === 0;
        return (
          <section
            className={`landing-feature-block ${isDark ? "landing-feature-block--dark" : "landing-feature-block--light"}`}
            key={cat.id}
          >
            <div className="landing-container">
              <h2 className="landing-section-title landing-feature-block-title">
                <span className="landing-feature-block-title-inner">{cat.name}</span>
              </h2>

              {cat.carouselImages.length > 0 ? (
                // Frame con padding a los costados — mismo mecanismo que .landing-carousel
                // (Descuento y Ofertas / Explora Nuestras Marcas): las flechas de ImageCarousel
                // (position:absolute) anclan a ESTE contenedor en vez de a .landing-feature-visual,
                // así quedan en ese margen, afuera de la imagen, no superpuestas encima.
                <div className="landing-feature-visual-frame">
                  <div className="landing-feature-visual">
                    <ImageCarousel
                      images={cat.carouselImages}
                      alt={cat.name}
                      imgClassName="landing-feature-visual-image"
                      autoplayMs={FEATURE_AUTOPLAY_MS}
                      visibleCount={isMobile ? 1 : 3}
                      mobileMediaQuery={MOBILE_BREAKPOINT}
                      renderOverlay={(image) => (
                        <div className="landing-feature-overlay">
                          <div className="landing-feature-overlay-text">
                            {image.titulo1 && <p className="landing-feature-overlay-subtitle">{image.titulo1}</p>}
                            {image.titulo2 && <h3 className="landing-feature-overlay-title">{image.titulo2}</h3>}
                          </div>
                          {image.url && (
                            <a href={image.url} className="landing-btn landing-btn-primary landing-feature-overlay-btn">
                              Ver Todo
                            </a>
                          )}
                        </div>
                      )}
                    />
                  </div>
                </div>
              ) : (
                <Link
                  href={`/categoria/${cat.slug}`}
                  className="landing-feature-visual landing-feature-visual--fallback"
                  style={{ background: isDark ? "linear-gradient(150deg, #594d46, #080706)" : "linear-gradient(150deg, #d1b280, #594d46)" }}
                />
              )}
            </div>
          </section>
        );
      })}

      {/* ======== 6. Sobre nosotros + Newsletter: misma fila, 2 columnas con difuminado ======== */}
      <section id="nosotros" className="landing-about-newsletter-row">
        <div className="landing-about-newsletter-col landing-about-newsletter-col--about">
          <div className="landing-about">
            <p className="landing-eyebrow">Nuestra filosofía</p>
            <h2 className="landing-section-title">Sobre {brandName}</h2>
            <p>
              En {brandName} creemos que la perfumería va mucho más allá de elegir una fragancia. Cada aroma tiene
              el poder de despertar sensaciones, evocar recuerdos y conectar con nuestra propia identidad.
            </p>
            <p>
              Por eso, buscamos transformar cada compra en una experiencia de descubrimiento, donde la atención
              personalizada, el conocimiento y la conexión con nuestros clientes sean tan importantes como el
              perfume que eligen.
            </p>
            <p>
              <strong>Porque para nosotros, el aroma es solo el comienzo.</strong>
            </p>
          </div>
        </div>

        <div className="landing-about-newsletter-col landing-about-newsletter-col--newsletter">
          <div className="landing-newsletter">
            <p className="landing-eyebrow">Newsletter</p>
            <h2 className="landing-section-title">Enterate de nuestras novedades</h2>
            <p className="landing-section-lead" style={{ margin: "0 auto 32px" }}>
              Lanzamientos, ofertas y novedades del catálogo
            </p>
            <div className="landing-newsletter-form">
              <a
                className="landing-btn landing-btn-primary"
                href={contacto?.canalOfertasUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
              >
                Canal de ofertas
              </a>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}

/** Bloque "Explora Nuestras Marcas" del home, debajo de "Colección de la semana" — antes era un
 * carrusel de logos repetido dentro de cada bloque de "Producto destacado" (uno por categoría raíz,
 * ver sección 4 más abajo); se sacó de ahí por redundante y se unificó acá en un solo bloque con
 * pestañas para alternar de categoría, en vez de mostrar las tres a la vez. */
function BrandsShowcase({ rootCategories, brands }: { rootCategories: Category[]; brands: Brand[] }) {
  // Solo categorías con alguna marca asignada a una subcategoría suya — una marca nunca se asigna
  // directo a una raíz (ver BrandsPage/assertCategoriesExist).
  const categoriesWithBrands = rootCategories.filter((cat) =>
    brands.some((b) => b.categories.some((bc) => bc.category.parentId === cat.id)),
  );
  const [activeCategoryId, setActiveCategoryId] = useState("");

  useEffect(() => {
    if (activeCategoryId || categoriesWithBrands.length === 0) return;
    setActiveCategoryId(categoriesWithBrands[0].id);
  }, [categoriesWithBrands, activeCategoryId]);

  const activeCategory = categoriesWithBrands.find((c) => c.id === activeCategoryId) ?? null;
  if (!activeCategory) return null;

  const activeBrands = brands.filter((b) => b.categories.some((bc) => bc.category.parentId === activeCategory.id));

  return (
    <section className="landing-section">
      <div className="landing-container">
        <div className="landing-brands-showcase-header">
          <div>
            <p className="landing-eyebrow">Explora Nuestras Marcas</p>
            <h2 className="landing-section-title">Más de 100 marcas</h2>
          </div>
          {categoriesWithBrands.length > 1 && (
            <div className="landing-brands-tabs">
              {categoriesWithBrands.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`landing-brands-tab${cat.id === activeCategory.id ? " landing-brands-tab--active" : ""}`}
                  onClick={() => setActiveCategoryId(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* `key` fuerza a remontar el carrusel al cambiar de pestaña — así slide/autoplay arrancan
            de cero en vez de arrastrar la posición de la categoría anterior. */}
        <BrandsCarousel key={activeCategory.id} brands={activeBrands} rootCategory={activeCategory} />
      </div>
    </section>
  );
}

/** Carrusel de nombres de marca de una categoría raíz — mismo mecanismo que el carrusel de
 * "Descuento y Ofertas" de arriba (flechas + autoplay), de 7 en 7 (4 en mobile). */
function BrandsCarousel({ brands, rootCategory }: { brands: Brand[]; rootCategory: { id: string; slug: string } }) {
  const [slide, setSlide] = useState(0);
  const [autoKey, setAutoKey] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  // null/false tratados igual (lado mobile/seguro) — mismo criterio que el isMobile del carrusel de
  // ofertas más arriba (ver su comentario): el servidor no sabe el ancho real, así que el primer
  // HTML siempre es el mismo para todos. Acá no hay alto medido por JS que se pueda quedar
  // "pegado" como en ese otro carrusel (el grid crece y achica solo, por CSS), pero igual conviene
  // partir del tamaño de página chico en vez de mostrar de entrada 7 nombres en 2 columnas.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT);
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const slideSize = isMobile === false ? BRANDS_SLIDE_SIZE : BRANDS_SLIDE_SIZE_MOBILE;
  const chunks = useMemo(() => chunk(brands, slideSize), [brands, slideSize]);

  useEffect(() => {
    if (chunks.length <= 1) return;
    const timer = setInterval(() => {
      setDirection(1);
      setSlide((s) => (s + 1) % chunks.length);
    }, BRANDS_AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [chunks.length, autoKey]);

  function goTo(index: number, dir: 1 | -1) {
    const total = chunks.length;
    if (total === 0) return;
    setDirection(dir);
    setSlide(((index % total) + total) % total);
    setAutoKey((k) => k + 1);
  }

  if (chunks.length === 0) return null;

  return (
    <div className="landing-carousel landing-brands-carousel">
      <button
        type="button"
        className="landing-carousel-arrow landing-carousel-arrow--prev"
        aria-label="Marcas anteriores"
        onClick={() => goTo(slide - 1, -1)}
        disabled={chunks.length <= 1}
      >
        ‹
      </button>

      <div className={`landing-brand-grid${direction === 1 ? " landing-brand-grid--next" : " landing-brand-grid--prev"}`} key={slide}>
        {chunks[slide].map((brand, i) =>
          brand.logoUrl ? (
            <Link href={brandLinkHref(rootCategory, brand)} className="landing-brand-card" key={brand.id} title={brand.name}>
              <img className="landing-brand-card-logo" src={productImageSrc(brand.logoUrl)!} alt={brand.name} />
            </Link>
          ) : (
            <Link href={brandLinkHref(rootCategory, brand)} className="landing-brand-card" key={brand.id}>
              <span className="landing-brand-card-name" style={{ color: BRAND_CARD_COLORS[i % BRAND_CARD_COLORS.length] }}>
                {brand.name}
              </span>
            </Link>
          ),
        )}
      </div>

      <button
        type="button"
        className="landing-carousel-arrow landing-carousel-arrow--next"
        aria-label="Siguientes marcas"
        onClick={() => goTo(slide + 1, 1)}
        disabled={chunks.length <= 1}
      >
        ›
      </button>
    </div>
  );
}

/** Negro o blanco según qué tan clara es la variante — así el pill de un acorde elegido (ver
 * ScentFinder) se puede rellenar con su propio color guardado en vez de un navy genérico, sin que
 * el texto se vuelva ilegible en los acordes de color claro (ej. "Atalcado", "Cítrico"). Fórmula
 * YIQ estándar (percepción de brillo), no luminancia relativa WCAG completa — alcanza para este uso. */
function getContrastTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? "#1a2234" : "#ffffff";
}

/** "Encuentra tu aroma ideal" — prefiltrado rápido de Perfumes antes de llegar a /categoria: elegís UN
 * acorde (de los marcados "Destacado" en Configuración → Atributos → Acordes, ver
 * handleOptionDestacadoChange en dashboard/attributes/page.tsx) + opcionalmente Subcategoría y
 * Género/Concentración (cualquier atributo filtrable de una sola opción que tenga la categoría, sin
 * hardcodear sus nombres), y "Ver {acorde}" arma la URL de /categoria/perfumes con esos mismos
 * filtros ya aplicados (mismo formato subcategoria=id / attr[id]=valor que ya entiende esa página).
 * No incluye Presentación (talle) a propósito — ver conversación: ese atributo es "con precio
 * propio" (cada talle es una variante con su propio precio) y el motor de filtros actual no lo
 * soporta como filtro de catálogo. Tampoco incluye precio — a pedido, se sacó el filtro de rango de
 * precio de este bloque. */
function ScentFinder({ category, subcategories }: { category: Category; subcategories: Category[] }) {
  const [attributes, setAttributes] = useState<Attribute[] | null>(null);
  const [selectedAcordeId, setSelectedAcordeId] = useState("");
  const [selectedSubcategoriaId, setSelectedSubcategoriaId] = useState("");
  const [selectedByAttribute, setSelectedByAttribute] = useState<Record<string, string>>({});

  useEffect(() => {
    apiGet<Attribute[]>(`/catalog/categories/${category.id}/filters`).then(setAttributes).catch(() => {});
  }, [category.id]);

  // El atributo de acordes es el único allowMultiple de la categoría — no hace falta buscarlo por
  // nombre (ver doc de arriba).
  const acordesAttribute = attributes?.find((a) => a.allowMultiple) ?? null;
  const destacados = useMemo(
    () => [...(acordesAttribute?.options ?? [])].filter((o) => o.destacadoHome).sort((a, b) => a.ordenDestacado - b.ordenDestacado),
    [acordesAttribute],
  );
  // Género, Concentración, o cualquier otro filtro de una sola opción que la categoría tenga —
  // tampoco hardcodeado por nombre, así el widget no se rompe si se renombra o agrega uno nuevo.
  const dropdownAttributes = attributes?.filter((a) => a.type === "SELECT" && a.variantMode === "NONE" && !a.allowMultiple) ?? [];

  useEffect(() => {
    if (selectedAcordeId || destacados.length === 0) return;
    setSelectedAcordeId(destacados[0].id);
  }, [destacados, selectedAcordeId]);

  if (!acordesAttribute || destacados.length === 0) return null;

  const selectedAcorde = destacados.find((o) => o.id === selectedAcordeId) ?? destacados[0];

  const params = new URLSearchParams();
  params.set(`attr[${acordesAttribute.id}]`, selectedAcorde.id);
  // "subcategoria" (no attr[...]) porque así es como /categoria/[slug] ya lo lee — mismo param que
  // usan el navbar y el logo de marca del home, no uno nuevo. Va por slug, no por id (ver
  // resolveSubCategorySlug en categoria-query.ts).
  const selectedSubcategoriaSlug = subcategories.find((s) => s.id === selectedSubcategoriaId)?.slug;
  if (selectedSubcategoriaSlug) params.set("subcategoria", selectedSubcategoriaSlug);
  for (const attr of dropdownAttributes) {
    const value = selectedByAttribute[attr.id];
    if (value) params.set(`attr[${attr.id}]`, value);
  }
  const href = `/categoria/${category.slug}?${params.toString()}`;

  return (
    <section className="landing-section">
      <div className="landing-container">
        <div className="landing-scent-finder-card">
          <div className="landing-scent-finder-header">
            <div>
              <p className="landing-eyebrow">Encontrá tu aroma</p>
              <h2 className="landing-section-title landing-scent-finder-title">Encuentra tu aroma ideal</h2>
            </div>
            <p className="landing-scent-finder-lead">Filtrá por familia olfativa, género y concentración</p>
          </div>

          <div className="landing-scent-finder-pills">
            {destacados.map((option) => {
              const isActive = option.id === selectedAcorde.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`landing-scent-finder-pill${isActive ? " landing-scent-finder-pill--active" : ""}`}
                  onClick={() => setSelectedAcordeId(option.id)}
                  style={
                    isActive && option.color
                      ? { background: option.color, borderColor: option.color, color: getContrastTextColor(option.color) }
                      : undefined
                  }
                >
                  {option.color && <span className="landing-filter-swatch" style={{ background: option.color }} />}
                  {option.value}
                </button>
              );
            })}
          </div>

          <div className="landing-scent-finder-fields">
            {subcategories.length > 0 && (
              <label className="landing-scent-finder-field">
                Subcategoría
                <select
                  className="landing-select"
                  value={selectedSubcategoriaId}
                  onChange={(e) => setSelectedSubcategoriaId(e.target.value)}
                >
                  <option value="">Todas</option>
                  {subcategories.map((sub) => (
                    <option value={sub.id} key={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {dropdownAttributes.map((attr) => (
              <label className="landing-scent-finder-field" key={attr.id}>
                {attr.name}
                <select
                  className="landing-select"
                  value={selectedByAttribute[attr.id] ?? ""}
                  onChange={(e) => setSelectedByAttribute((prev) => ({ ...prev, [attr.id]: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {attr.options.map((option) => (
                    <option value={option.id} key={option.id}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="landing-scent-finder-footer">
            <Link href={href} className="landing-btn landing-btn-primary">
              Ver {selectedAcorde.value.toLowerCase()}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
