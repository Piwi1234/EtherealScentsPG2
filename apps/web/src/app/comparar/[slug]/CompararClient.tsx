"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAllAttributeDetails, getContrastTextColor, productImageSrc } from "../../../lib/catalog-display";
import type { Product, SimilarByAccordsResponse } from "../../../lib/types";
import { LandingNavbar } from "../../../components/landing/LandingNavbar";
import { LandingFooter } from "../../../components/landing/LandingFooter";
import { ProductCard } from "../../../components/landing/ProductCard";

// Mismo tope pedido para el botón "Ver similares": 20 tarjetas por página, 5 por fila (ver
// .landing-product-grid--5col en globals.css) = 4 filas por página.
const PAGE_SIZE = 20;

type FlatEntry = { matchCount: number; product: Product };

/** Client Component a propósito (a diferencia de /producto/[slug]) — el paginado necesita estado
 * propio para poder animar el scroll hacia arriba al cambiar de página (mismo scrollIntoView suave
 * que ya usan /categoria y /buscar), algo que un <Link href="?page=N"> no puede hacer solo. El
 * primer fetch (producto + similares) sigue siendo del server (ver page.tsx), nada más el paginado
 * en sí vive acá. */
export function CompararClient({
  product,
  similar,
  initialPageNumber,
}: {
  product: Product;
  similar: SimilarByAccordsResponse;
  initialPageNumber: number;
}) {
  const router = useRouter();
  const [pageNumber, setPageNumber] = useState(initialPageNumber);

  // Se aplana para paginar de a PAGE_SIZE sin importar en qué grupo cae cada tarjeta — ya viene
  // ordenado por matchCount descendente (4/4, 3/4... nunca menos de 3, ver MIN_SIMILAR_ACCORD_MATCH
  // en browse.service.ts) desde el backend.
  const flat: FlatEntry[] = similar.groups.flatMap((group) =>
    group.items.map((item) => ({ matchCount: group.matchCount, product: item })),
  );
  const totalPages = Math.max(1, Math.ceil(flat.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, pageNumber), totalPages);
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

  // Mantiene ?page= sincronizado con la página actual (router.replace, sin agregar historial propio)
  // — mismo criterio que /categoria y /buscar: "atrás" desde la ficha de un perfume similar vuelve a
  // esta misma página en vez de reiniciar el paginado.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (currentPage > 1) params.set("page", String(currentPage));
    else params.delete("page");
    const query = params.toString();
    router.replace(query ? `${window.location.pathname}?${query}` : window.location.pathname, { scroll: false });
  }, [currentPage, router]);

  function goToPage(target: number) {
    setPageNumber(target);
    document.getElementById("compare-results-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        <div className="landing-container" id="compare-results-top">
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
              <button
                type="button"
                className="landing-btn landing-btn-outline-dark"
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
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
                onClick={() => goToPage(currentPage + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
