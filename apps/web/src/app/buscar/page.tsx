"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiGet } from "../../lib/api";
import type { Page, Product } from "../../lib/types";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { ProductCard } from "../../components/landing/ProductCard";

// Mismo criterio que /categoria/[id]: 4 tarjetas por fila x 5 filas visibles antes de paginar.
const CARDS_PER_PAGE = 20;

// useSearchParams (a diferencia de leer window.location.search a mano) es reactivo a los cambios de
// query string entre navegaciones del lado del cliente a esta misma ruta — antes, buscar un segundo
// término desde el navbar (router.push("/buscar?q=...") sin desmontar la página) no disparaba una
// nueva búsqueda porque el efecto de fetch tenía dependencias vacías ([]), solo corría al montar.
function BuscarContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [productsPage, setProductsPage] = useState<Page<Product> | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    setPageNumber(1);
    setError("");
    if (!query.trim()) {
      setProductsPage({ items: [], total: 0, page: 1, pageSize: 0 });
      return;
    }
    setProductsPage(null);
    const params = new URLSearchParams({ search: query, pageSize: "200" });
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then(setProductsPage)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [query]);

  const items = productsPage?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(items.length / CARDS_PER_PAGE));
  const currentPage = Math.min(pageNumber, totalPages);
  const pagedProducts = items.slice((currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE);

  return (
    <>
      <div className="landing-breadcrumb-bar">
        <div className="landing-container">
          <p className="landing-breadcrumb">
            <Link href="/home">Inicio</Link>
            <span>/</span>
            <span className="landing-breadcrumb-current">Resultados de búsqueda</span>
          </p>
        </div>
      </div>

      <section className="landing-category-header">
        <div className="landing-container">
          <h1>Resultados de búsqueda</h1>
          <p className="landing-category-lead">
            {query ? `Coincidencias para "${query}".` : "Escribí algo en el buscador del navbar para empezar."}
          </p>
        </div>
      </section>

      <section className="landing-section landing-section--category">
        <div className="landing-container">
          {error && <p className="error-text">{error}</p>}
          {!productsPage && !error && <p className="landing-empty-note">Buscando...</p>}
          {productsPage && query && items.length === 0 && (
            <p className="landing-empty-note">No encontramos productos que coincidan con &quot;{query}&quot;.</p>
          )}

          {pagedProducts.length > 0 && (
            <>
              <div className="landing-product-grid" id="search-results-grid">
                {pagedProducts.map((product) => (
                  <ProductCard product={product} key={product.id} />
                ))}
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
    </>
  );
}

export default function BuscarPage() {
  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />
      <Suspense fallback={null}>
        <BuscarContent />
      </Suspense>
      <LandingFooter />
    </div>
  );
}
