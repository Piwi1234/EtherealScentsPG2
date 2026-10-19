import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet, ApiError } from "../../../lib/api";
import { getAllAttributeDetails, getContrastTextColor, productImageSrc } from "../../../lib/catalog-display";
import type { Product, SimilarByAccordsResponse } from "../../../lib/types";
import { LandingNavbar } from "../../../components/landing/LandingNavbar";
import { LandingFooter } from "../../../components/landing/LandingFooter";
import { ProductCard } from "../../../components/landing/ProductCard";

// Mismo tope pedido para el botón "Ver similares": 20 tarjetas por página, 5 por fila (ver
// .landing-product-grid--5col en globals.css) = 4 filas por página.
const PAGE_SIZE = 20;

async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    return await apiGet<Product>(`/catalog/products/slug/${slug}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

type FlatEntry = { matchCount: number; product: Product };

/** Server Component a propósito, igual que /producto/[slug] — no hay ningún filtro/estado que
 * justifique un Client Component acá, así que hasta el paginado es por Link (?page=N), sin JS. */
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

  // Se aplana para paginar de a PAGE_SIZE sin importar en qué grupo cae cada tarjeta — ya viene
  // ordenado por matchCount descendente (4/4, 3/4... nunca menos de 3, ver MIN_SIMILAR_ACCORD_MATCH
  // en browse.service.ts) desde el backend.
  const flat: FlatEntry[] = similar.groups.flatMap((group) =>
    group.items.map((item) => ({ matchCount: group.matchCount, product: item })),
  );
  const totalPages = Math.max(1, Math.ceil(flat.length / PAGE_SIZE));
  const pageFromQuery = Math.floor(Number(page ?? "1"));
  const currentPage = Number.isFinite(pageFromQuery) && pageFromQuery > 0 ? Math.min(pageFromQuery, totalPages) : 1;
  const pageItems = flat.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Agrupa las tarjetas de ESTA página en tandas consecutivas por matchCount (una sección con su
  // propio título por tanda). Si un grupo del backend cruza el límite de página, la tanda que sigue
  // en la página siguiente repite el mismo título — es el mismo grupo, no hace falta un texto de
  // "continuación" aparte.
  const pageSections: { matchCount: number; items: FlatEntry[] }[] = [];
  for (const entry of pageItems) {
    const last = pageSections[pageSections.length - 1];
    if (last && last.matchCount === entry.matchCount) last.items.push(entry);
    else pageSections.push({ matchCount: entry.matchCount, items: [entry] });
  }

  function pageHref(targetPage: number): string {
    return `/comparar/${slug}${targetPage > 1 ? `?page=${targetPage}` : ""}`;
  }

  // "Acordes" va aparte, como las barras de color (ver más abajo) — el resto (Género, Concentración,
  // etc.) se muestra como la lista de atributos normal, igual que "Detalles" en /producto/[slug].
  const otherDetails = getAllAttributeDetails(product).filter((d) => d.nombre !== "Acordes");
  const heroImage = productImageSrc(product.imageUrl);

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      <div className="landing-breadcrumb-bar">
        <div className="landing-container">
          <p className="landing-breadcrumb">
            <Link href="/home">Inicio</Link>
            <span>/</span>
            <Link href={`/producto/${product.slug}`}>{product.name}</Link>
            <span>/</span>
            <span className="landing-breadcrumb-current">Perfumes similares</span>
          </p>
        </div>
      </div>

      <section className="landing-category-header landing-compare-hero">
        <div className="landing-container">
          <div className="landing-compare-hero-inner">
            <p className="landing-category-lead" style={{ marginBottom: 4 }}>
              Perfumes similares
            </p>
            <h1>{product.name}</h1>
            {product.brand && (
              <p className="landing-category-lead">
                De <strong>{product.brand.name}</strong>
              </p>
            )}

            <div className="landing-compare-hero-row">
              <div className="landing-compare-hero-image">
                {heroImage ? (
                  <img src={heroImage} alt={product.name} />
                ) : (
                  <div className="landing-compare-hero-image-placeholder">{product.name.slice(0, 1)}</div>
                )}
              </div>

              <div className="landing-compare-hero-info">
                {otherDetails.length > 0 && (
                  <div className="landing-product-detail-list landing-compare-hero-attrs">
                    {otherDetails.map((d) => (
                      <div className="landing-product-detail-list-row" key={d.key}>
                        <span>{d.nombre}</span>
                        <span>{d.valor}</span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="landing-compare-accords-label">Acordes principales</p>
                <div className="landing-compare-accords">
                  {similar.accords.map((accord) => (
                    <div
                      key={accord.id}
                      className="landing-compare-accord"
                      style={accord.color ? { background: accord.color, color: getContrastTextColor(accord.color) } : undefined}
                    >
                      {accord.name.toLowerCase()}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--category">
        <div className="landing-container">
          {flat.length === 0 && (
            <p className="landing-empty-note">No tenemos perfumes con acordes similares por el momento.</p>
          )}

          {pageSections.map((pageSection) => (
            <div className="landing-compare-section" key={pageSection.matchCount}>
              <div className="landing-compare-section-head">
                <h2 className="landing-compare-section-title">
                  Coinciden en {pageSection.matchCount} de {similar.totalAccords} acordes
                </h2>
                <span className="landing-compare-section-count">
                  {pageSection.items.length} perfume{pageSection.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="landing-product-grid landing-product-grid--5col">
                {pageSection.items.map(({ product: similarProduct }) => {
                  const cardAccords = similarProduct.attributeValues
                    .filter(
                      (av): av is typeof av & { option: NonNullable<typeof av.option> } =>
                        av.attribute.name === "Acordes" && av.option !== null,
                    )
                    .map((av) => ({ id: av.option.id, name: av.option.value, color: av.option.color }))
                    .sort((a, b) => a.name.localeCompare(b.name));
                  return <ProductCard key={similarProduct.id} product={similarProduct} accords={cardAccords} />;
                })}
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="landing-pagination">
              <Link
                href={pageHref(currentPage - 1)}
                className={`landing-btn landing-btn-outline-dark${currentPage <= 1 ? " disabled" : ""}`}
                aria-disabled={currentPage <= 1}
              >
                ← Anterior
              </Link>
              <span className="landing-pagination-info">
                Página {currentPage} de {totalPages}
              </span>
              <Link
                href={pageHref(currentPage + 1)}
                className={`landing-btn landing-btn-outline-dark${currentPage >= totalPages ? " disabled" : ""}`}
                aria-disabled={currentPage >= totalPages}
              >
                Siguiente →
              </Link>
            </div>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
