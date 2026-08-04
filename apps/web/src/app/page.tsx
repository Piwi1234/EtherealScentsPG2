"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_ORIGIN, apiGet } from "../lib/api";
import type { Category, Page, Product } from "../lib/types";

function productImageSrc(imageUrl: string | null): string | null {
  return imageUrl ? `${API_ORIGIN}${imageUrl}` : null;
}

/** Si el producto tiene variantes con precio propio, se muestra "Desde" el precio más bajo entre ellas. */
function displayPrice(product: Product): { bs: number; usd: number; fromPrice: boolean } {
  if (product.variants.length > 0) {
    const cheapest = product.variants.reduce((min, v) => (v.finalPriceBs < min.finalPriceBs ? v : min), product.variants[0]);
    return { bs: cheapest.finalPriceBs, usd: cheapest.price, fromPrice: product.variants.length > 1 };
  }
  return { bs: product.finalPriceBs, usd: product.price, fromPrice: false };
}

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rootCategoryFilter, setRootCategoryFilter] = useState("");
  const [page, setPage] = useState<Page<Product> | null>(null);
  const [error, setError] = useState("");

  const rootCategoryOptions = categories.filter((cat) => cat.parentId === null);

  useEffect(() => {
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (rootCategoryFilter) params.set("categoryId", rootCategoryFilter);
    params.set("pageSize", "48");
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then(setPage)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [rootCategoryFilter]);

  return (
    <div>
      <header className="public-topbar">
        <span className="public-brand">Catálogo</span>
        <Link href="/dashboard" className="button">Gestión</Link>
      </header>

      <main className="public-main">
        <div className="filters-bar">
          <div className="filter-field" style={{ minWidth: 200 }}>
            <label className="filter-label">Categoría</label>
            <select className="field" value={rootCategoryFilter} onChange={(e) => setRootCategoryFilter(e.target.value)}>
              <option value="">Todas</option>
              {rootCategoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}
        {!page && !error && <p>Cargando...</p>}
        {page && page.items.length === 0 && <p style={{ color: "var(--muted)" }}>No hay productos para mostrar.</p>}

        {page && page.items.length > 0 && (
          <div className="product-grid">
            {page.items.map((product) => {
              const { bs, usd, fromPrice } = displayPrice(product);
              const image = productImageSrc(product.imageUrl);
              return (
                <div className="product-card" key={product.id}>
                  {image ? (
                    <img className="product-card-image" src={image} alt={product.name} />
                  ) : (
                    <div className="product-card-image-placeholder">Sin imagen</div>
                  )}
                  <div className="product-card-body">
                    {product.brand && <span className="product-card-brand">{product.brand.name}</span>}
                    <span className="product-card-name">{product.name}</span>
                    <span className="product-card-price">
                      {fromPrice && <span style={{ fontWeight: 500, fontSize: 12, color: "var(--muted)" }}>Desde </span>}
                      Bs {bs.toFixed(2)}
                    </span>
                    <span className="product-card-price-usd">${usd.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
