"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, getBrands, getLandingImages } from "../../lib/api";
import { brandLinkHref, productImageSrc } from "../../lib/catalog-display";
import type { Brand, CarouselImage, Category } from "../../lib/types";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { ImageCarousel } from "../../components/landing/ImageCarousel";

const MARCAS_BANNER_AUTOPLAY_MS = 10000;

// Alfabeto español para el filtro por letra — Ñ como letra propia, "#" agrupa nombres que no
// arrancan con ninguna de estas (dígitos, símbolos).
const MARCAS_LETTERS = ["#", ..."ABCDEFGHIJKLMN".split(""), "Ñ", ..."OPQRSTUVWXYZ".split("")];

/** A qué letra del filtro pertenece una marca: la inicial en mayúscula, sin acentos (Álvarez → A),
 * con Ñ como bucket propio (distinto de N) — si no cae en A-Z ni Ñ (arranca con dígito o símbolo),
 * cae en "#". */
function marcaLetterBucket(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  if (first === "Ñ") return "Ñ";
  const normalized = first.replace(/[ÁÀÄÂ]/, "A").replace(/[ÉÈËÊ]/, "E").replace(/[ÍÌÏÎ]/, "I").replace(/[ÓÒÖÔ]/, "O").replace(/[ÚÙÜÛ]/, "U");
  return /^[A-Z]$/.test(normalized) ? normalized : "#";
}

export default function MarcasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [marcasHeroImages, setMarcasHeroImages] = useState<CarouselImage[]>([]);
  const [rootCategoryFilter, setRootCategoryFilter] = useState("");
  const [subCategoryFilter, setSubCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [letterFilter, setLetterFilter] = useState("");
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

  // Cambiar de categoría raíz limpia el filtro de subcategoría y de letra — son específicos de la
  // raíz anterior (una letra sin marcas en la categoría nueva dejaría la grilla vacía sin aviso).
  useEffect(() => {
    setSubCategoryFilter("");
    setLetterFilter("");
  }, [rootCategoryFilter]);

  const selectedCategory = rootCategories.find((c) => c.id === rootCategoryFilter) ?? null;

  const subcategories = useMemo(
    () =>
      categories
        .filter((c) => c.parentId === rootCategoryFilter)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, rootCategoryFilter],
  );

  // Sin el filtro de letra todavía — de acá salen las letras disponibles para la grilla de abajo,
  // así siguen mostrando todas las que tienen alguna marca aunque ya haya una letra elegida.
  const searchFilteredBrands = useMemo(() => {
    if (!rootCategoryFilter) return [];
    const query = search.trim().toLowerCase();
    return brands
      .filter((b) =>
        subCategoryFilter
          ? b.categories.some((bc) => bc.categoryId === subCategoryFilter)
          : b.categories.some((bc) => bc.category.parentId === rootCategoryFilter),
      )
      .filter((b) => !query || b.name.toLowerCase().includes(query));
  }, [brands, rootCategoryFilter, subCategoryFilter, search]);

  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    for (const b of searchFilteredBrands) set.add(marcaLetterBucket(b.name));
    return set;
  }, [searchFilteredBrands]);

  const filteredBrands = useMemo(() => {
    const list = letterFilter ? searchFilteredBrands.filter((b) => marcaLetterBucket(b.name) === letterFilter) : searchFilteredBrands;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [searchFilteredBrands, letterFilter]);

  // Tocar la letra ya elegida la destilda (vuelve a mostrar todas), como cualquier otro filtro tipo pill.
  function selectLetter(letter: string) {
    setLetterFilter((prev) => (prev === letter ? "" : letter));
  }

  // Agrupa por inicial (A, B, C...) para que la grilla se recorra alfabéticamente en bloques — mismo
  // criterio que el filtro de letras de arriba (Ñ propia, "#" para lo que no cae en A-Z/Ñ).
  const brandGroups = useMemo(() => {
    const groups = new Map<string, Brand[]>();
    for (const brand of filteredBrands) {
      const letter = marcaLetterBucket(brand.name);
      const list = groups.get(letter);
      if (list) list.push(brand);
      else groups.set(letter, [brand]);
    }
    return Array.from(groups.entries());
  }, [filteredBrands]);

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      <section className="landing-category-banner landing-category-banner--no-overlay">
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

      {subcategories.length > 0 && (
        <div className="landing-marcas-subnav">
          <div className="landing-container landing-marcas-subnav-inner">
            <button
              type="button"
              className={`landing-pill landing-pill-sm${subCategoryFilter === "" ? " landing-pill-active" : ""}`}
              onClick={() => setSubCategoryFilter("")}
            >
              Todas
            </button>
            {subcategories.map((sub) => (
              <button
                key={sub.id}
                type="button"
                className={`landing-pill landing-pill-sm${subCategoryFilter === sub.id ? " landing-pill-active" : ""}`}
                onClick={() => setSubCategoryFilter(sub.id)}
              >
                {sub.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedCategory && (
        <div className="landing-marcas-letters">
          <div className="landing-container">
            <p className="landing-marcas-letters-title">Todas las marcas</p>
            <div className="landing-marcas-letters-row">
              {MARCAS_LETTERS.map((letter) => {
                const disabled = !availableLetters.has(letter);
                return (
                  <button
                    type="button"
                    key={letter}
                    disabled={disabled}
                    className={`landing-marcas-letter-btn${letterFilter === letter ? " landing-marcas-letter-btn--active" : ""}${disabled ? " landing-marcas-letter-btn--disabled" : ""}`}
                    onClick={() => selectLetter(letter)}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
              {(() => {
                const scopeName = subcategories.find((s) => s.id === subCategoryFilter)?.name ?? selectedCategory.name;
                if (search) return `No hay marcas que coincidan con "${search}" en ${scopeName}.`;
                if (letterFilter) return `No hay marcas que empiecen con "${letterFilter}" en ${scopeName}.`;
                return `Todavía no hay marcas cargadas en ${scopeName}.`;
              })()}
            </p>
          )}

          {brandGroups.map(([letter, groupBrands]) => (
            <div className="landing-marcas-letter-group" key={letter}>
              <h2 className="landing-marcas-letter-heading">{letter}</h2>
              <div className="landing-marcas-grid">
                {groupBrands.map((brand) => (
                  <Link
                    href={
                      selectedCategory && subCategoryFilter
                        ? `/categoria/${selectedCategory.slug}?marca=${brand.id}&subcategoria=${subCategoryFilter}`
                        : selectedCategory
                          ? brandLinkHref(selectedCategory, brand)
                          : "#"
                    }
                    className="landing-marca-card"
                    key={brand.id}
                  >
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
