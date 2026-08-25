"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "../../lib/api";
import { cardImageUrl, displayPrice, hasDiscount, isSoldOut, productImageSrc } from "../../lib/catalog-display";
import type { Page, Product } from "../../lib/types";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { formatAtributosVisiblesValores } from "../../components/proformas/AtributosVisibles";

// Mismo criterio que /categoria/[id]: 4 tarjetas por fila x 5 filas visibles antes de paginar.
const CARDS_PER_PAGE = 20;

export default function BuscarPage() {
  const [query, setQuery] = useState("");
  const [productsPage, setProductsPage] = useState<Page<Product> | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q") ?? "";
    setQuery(q);
    setPageNumber(1);
    if (!q.trim()) {
      setProductsPage({ items: [], total: 0, page: 1, pageSize: 0 });
      return;
    }
    setProductsPage(null);
    const params = new URLSearchParams({ search: q, pageSize: "200" });
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then(setProductsPage)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const items = productsPage?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(items.length / CARDS_PER_PAGE));
  const currentPage = Math.min(pageNumber, totalPages);
  const pagedProducts = items.slice((currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE);

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" />

      <section className="landing-category-banner">
        <div className="landing-container">
          <h1>Resultados de búsqueda</h1>
          <p className="landing-category-lead">
            {query ? `Coincidencias para "${query}".` : "Escribí algo en el buscador del navbar para empezar."}
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          {error && <p className="error-text">{error}</p>}
          {!productsPage && !error && <p className="landing-empty-note">Buscando...</p>}
          {productsPage && query && items.length === 0 && (
            <p className="landing-empty-note">No encontramos productos que coincidan con &quot;{query}&quot;.</p>
          )}

          {pagedProducts.length > 0 && (
            <>
              <div className="landing-product-grid" id="search-results-grid">
                {pagedProducts.map((product) => {
                  const { bs, fromPrice, variant } = displayPrice(product);
                  const image = productImageSrc(cardImageUrl(product, variant));
                  const atributos = formatAtributosVisiblesValores(product.attributeValues, product.variantOptionValues);
                  return (
                    <Link href={`/producto/${product.id}`} className="landing-product-card" key={product.id}>
                      <div className="landing-product-image-wrap">
                        {image ? (
                          <img className="landing-product-image" src={image} alt={product.name} />
                        ) : (
                          <div className="landing-product-image-placeholder">{product.name.slice(0, 1)}</div>
                        )}
                        {hasDiscount(product) && (
                          <span className="landing-product-offer-badge">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
                              <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
                              <path d="M2.5 3h2.4l2.2 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" />
                            </svg>
                            Oferta
                          </span>
                        )}
                      </div>
                      <div className="landing-product-body">
                        {product.brand && <span className="landing-product-brand">{product.brand.name}</span>}
                        <p className="landing-product-name">{product.name}</p>
                        {atributos && <p className="landing-product-attrs">{atributos}</p>}
                        {isSoldOut(product) ? (
                          <span className="landing-product-soldout-stamp">Sold Out</span>
                        ) : (
                          <span className="landing-product-price">
                            {fromPrice ? "Desde " : ""}Bs {bs.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="landing-pagination">
                  <button
                    type="button"
                    className="landing-btn landing-btn-outline-dark"
                    disabled={currentPage <= 1}
                    onClick={() => {
                      setPageNumber(currentPage - 1);
                      document.getElementById("search-results-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
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
                    onClick={() => {
                      setPageNumber(currentPage + 1);
                      document.getElementById("search-results-grid")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
