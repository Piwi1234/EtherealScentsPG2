"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet, ApiError } from "../../../lib/api";
import { displayPrice, productImageSrc } from "../../../lib/catalog-display";
import type { Category, Page, Product } from "../../../lib/types";
import { LandingNavbar } from "../../../components/landing/LandingNavbar";
import { LandingFooter } from "../../../components/landing/LandingFooter";

type SortBy = "relevancia" | "precio-asc" | "precio-desc" | "nombre-asc";

export default function CategoriaPage() {
  const { id } = useParams<{ id: string }>();

  const [category, setCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productsPage, setProductsPage] = useState<Page<Product> | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  const [subCategoryFilter, setSubCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("relevancia");

  // Todas las categorías (para armar el breadcrumb y las subcategorías) — la categoría cambia con la ruta.
  useEffect(() => {
    setSubCategoryFilter("");
    setBrandFilter("");
    setSortBy("relevancia");
    setNotFound(false);
    setCategory(null);
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    apiGet<Category>(`/categories/${id}`)
      .then(setCategory)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : String(e));
      });
  }, [id]);

  useEffect(() => {
    if (!category) return;
    const params = new URLSearchParams();
    params.set("categoryId", subCategoryFilter || category.id);
    params.set("pageSize", "60");
    apiGet<Page<Product>>(`/catalog/products?${params.toString()}`)
      .then(setProductsPage)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [category, subCategoryFilter]);

  const subcategories = categories.filter((c) => c.parentId === id);
  const parentCategory = category?.parentId ? categories.find((c) => c.id === category.parentId) ?? null : null;

  const availableBrands = useMemo(() => {
    if (!productsPage) return [];
    const byId = new Map<string, string>();
    for (const product of productsPage.items) {
      if (product.brand) byId.set(product.brand.id, product.brand.name);
    }
    return Array.from(byId, ([brandId, name]) => ({ id: brandId, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [productsPage]);

  const displayedProducts = useMemo(() => {
    if (!productsPage) return [];
    let items = productsPage.items;
    if (brandFilter) items = items.filter((p) => p.brand?.id === brandFilter);
    items = [...items];
    if (sortBy === "precio-asc") items.sort((a, b) => displayPrice(a).bs - displayPrice(b).bs);
    else if (sortBy === "precio-desc") items.sort((a, b) => displayPrice(b).bs - displayPrice(a).bs);
    else if (sortBy === "nombre-asc") items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [productsPage, brandFilter, sortBy]);

  if (notFound) {
    return (
      <div className="landing-page">
        <LandingNavbar />
        <section className="landing-category-banner">
          <h1>Categoría no encontrada</h1>
          <p className="landing-category-lead">
            No pudimos encontrar esta categoría. <Link href="/home">Volvé al inicio</Link>.
          </p>
        </section>
        <LandingFooter />
      </div>
    );
  }

  return (
    <div className="landing-page">
      <LandingNavbar />

      <section className="landing-category-banner">
        <div className="landing-container">
          <p className="landing-breadcrumb">
            <Link href="/home">Inicio</Link>
            <span>/</span>
            {parentCategory && (
              <>
                <Link href={`/categoria/${parentCategory.id}`}>{parentCategory.name}</Link>
                <span>/</span>
              </>
            )}
            <span className="landing-breadcrumb-current">{category?.name ?? "..."}</span>
          </p>
          <h1>{category?.name ?? "Cargando..."}</h1>
          <p className="landing-category-lead">
            {category?.comentario || `Descubrí nuestra selección de ${(category?.name ?? "").toLowerCase()}, con stock real y precios claros.`}
          </p>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          <div className="landing-toolbar">
            <div className="landing-toolbar-filters">
              {subcategories.length > 0 && (
                <div>
                  <p className="landing-toolbar-filter-label">Subcategoría</p>
                  <div className="landing-filter-pills">
                    <button
                      type="button"
                      className={`landing-pill${subCategoryFilter === "" ? " landing-pill-active" : ""}`}
                      onClick={() => setSubCategoryFilter("")}
                    >
                      Todas
                    </button>
                    {subcategories.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        className={`landing-pill${subCategoryFilter === sub.id ? " landing-pill-active" : ""}`}
                        onClick={() => setSubCategoryFilter(sub.id)}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {availableBrands.length > 1 && (
                <div>
                  <p className="landing-toolbar-filter-label">Marca</p>
                  <div className="landing-filter-pills">
                    <button
                      type="button"
                      className={`landing-pill${brandFilter === "" ? " landing-pill-active" : ""}`}
                      onClick={() => setBrandFilter("")}
                    >
                      Todas
                    </button>
                    {availableBrands.map((brand) => (
                      <button
                        key={brand.id}
                        type="button"
                        className={`landing-pill${brandFilter === brand.id ? " landing-pill-active" : ""}`}
                        onClick={() => setBrandFilter(brand.id)}
                      >
                        {brand.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <select
              className="landing-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              aria-label="Ordenar por"
            >
              <option value="relevancia">Relevancia</option>
              <option value="precio-asc">Precio: menor a mayor</option>
              <option value="precio-desc">Precio: mayor a menor</option>
              <option value="nombre-asc">Nombre: A-Z</option>
            </select>
          </div>

          {error && <p className="error-text">{error}</p>}
          {!productsPage && !error && <p className="landing-empty-note">Cargando...</p>}
          {productsPage && displayedProducts.length === 0 && (
            <p className="landing-empty-note">No hay productos para mostrar con estos filtros.</p>
          )}

          {displayedProducts.length > 0 && (
            <div className="landing-product-grid">
              {displayedProducts.map((product) => {
                const { bs, usd, fromPrice } = displayPrice(product);
                const image = productImageSrc(product.imageUrl);
                return (
                  <div className="landing-product-card" key={product.id}>
                    {image ? (
                      <img className="landing-product-image" src={image} alt={product.name} />
                    ) : (
                      <div className="landing-product-image-placeholder">{product.name.slice(0, 1)}</div>
                    )}
                    <div className="landing-product-body">
                      {product.brand && <span className="landing-product-brand">{product.brand.name}</span>}
                      <p className="landing-product-name">{product.name}</p>
                      <span className="landing-product-price">
                        {fromPrice ? "Desde " : ""}Bs {bs.toFixed(2)}
                      </span>
                      <span className="landing-product-price-usd">(${usd.toFixed(2)})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
