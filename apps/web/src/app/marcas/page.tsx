"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, getBrands, getLandingImages } from "../../lib/api";
import { brandLinkHref, productImageSrc } from "../../lib/catalog-display";
import type { Brand, Category } from "../../lib/types";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { ImageCarousel } from "../../components/landing/ImageCarousel";

const MARCAS_BANNER_AUTOPLAY_MS = 10000;

export default function MarcasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [marcasHeroImages, setMarcasHeroImages] = useState<string[]>([]);
  const [rootCategoryFilter, setRootCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Category[]>("/categories")
      .then(setCategories)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getBrands()
      .then(setBrands)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    getLandingImages()
      .then((images) => setMarcasHeroImages(images.marcasHeroImages))
      .catch(() => {});
  }, []);

  const rootCategories = useMemo(
    () => categories.filter((c) => c.parentId === null).sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  // Arranca en la primera categoría raíz apenas cargan, para no mostrar la página vacía.
  useEffect(() => {
    if (!rootCategoryFilter && rootCategories.length > 0) setRootCategoryFilter(rootCategories[0].id);
  }, [rootCategories, rootCategoryFilter]);

  const selectedCategory = rootCategories.find((c) => c.id === rootCategoryFilter) ?? null;

  const filteredBrands = useMemo(() => {
    if (!rootCategoryFilter) return [];
    const query = search.trim().toLowerCase();
    return brands
      .filter((b) => b.categories.some((bc) => bc.category.parentId === rootCategoryFilter))
      .filter((b) => !query || b.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [brands, rootCategoryFilter, search]);

  // Agrupa por inicial (A, B, C...) para que la grilla se recorra alfabéticamente en bloques.
  const brandGroups = useMemo(() => {
    const groups = new Map<string, Brand[]>();
    for (const brand of filteredBrands) {
      const letter = brand.name.charAt(0).toUpperCase();
      const list = groups.get(letter);
      if (list) list.push(brand);
      else groups.set(letter, [brand]);
    }
    return Array.from(groups.entries());
  }, [filteredBrands]);

  return (
    <div className="landing-page">
      <LandingNavbar variant="light" />

      <section className="landing-category-banner">
        {marcasHeroImages.length > 0 && (
          <div className="landing-category-banner-bg">
            <ImageCarousel
              images={marcasHeroImages}
              alt=""
              imgClassName="landing-category-banner-bg-image"
              autoplayMs={MARCAS_BANNER_AUTOPLAY_MS}
            />
          </div>
        )}
        <div className="landing-container">
          <h1>Marcas</h1>
          <p className="landing-category-lead">Explorá las marcas que trabajamos, organizadas por categoría.</p>
        </div>
      </section>

      <div className="landing-marcas-nav">
        <div className="landing-container landing-marcas-nav-inner">
          {rootCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`landing-pill${rootCategoryFilter === cat.id ? " landing-pill-active" : ""}`}
              onClick={() => setRootCategoryFilter(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <section className="landing-section">
        <div className="landing-container">
          {error && <p className="error-text">{error}</p>}
          {!error && rootCategories.length === 0 && <p className="landing-empty-note">Cargando...</p>}

          <div className="landing-marcas-search-wrap">
            <input
              type="search"
              className="landing-marcas-search"
              placeholder="Buscar marca por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {selectedCategory && filteredBrands.length === 0 && (
            <p className="landing-empty-note">
              {search
                ? `No hay marcas que coincidan con "${search}" en ${selectedCategory.name}.`
                : `Todavía no hay marcas cargadas en ${selectedCategory.name}.`}
            </p>
          )}

          {brandGroups.map(([letter, groupBrands]) => (
            <div className="landing-marcas-letter-group" key={letter}>
              <h2 className="landing-marcas-letter-heading">{letter}</h2>
              <div className="landing-marcas-grid">
                {groupBrands.map((brand) => (
                  <Link href={brandLinkHref(rootCategoryFilter, brand)} className="landing-marca-card" key={brand.id}>
                    {brand.logoUrl ? (
                      <img className="landing-marca-logo" src={productImageSrc(brand.logoUrl)!} alt={brand.name} />
                    ) : (
                      <div className="landing-marca-logo-placeholder">{brand.name.slice(0, 1)}</div>
                    )}
                    <p className="landing-marca-name">{brand.name}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
