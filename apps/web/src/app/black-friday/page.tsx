"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, getPublicCombos } from "../../lib/api";
import { descuentoPct, offerVariantEntries } from "../../lib/catalog-display";
import { rangoCampana, useCampana } from "../../lib/campana";
import type { Category, Combo, Page, Product } from "../../lib/types";
import { LandingNavbar } from "../../components/landing/LandingNavbar";
import { LandingFooter } from "../../components/landing/LandingFooter";
import { CampanaCountdown } from "../../components/landing/CampanaCountdown";
import { ProductCard } from "../../components/landing/ProductCard";
import { ComboCard } from "../../components/landing/ComboCard";

const REBAJADOS = 8;

/**
 * Portada de la campaña activa (Black Friday, etc.): cuenta regresiva, lo más rebajado, los combos y un enlace a las ofertas flash. Funciona
 * con cualquier campaña que esté activa; sin una, avisa y lleva al inicio.
 */
export default function CampanaPage() {
  const campana = useCampana();
  const [productos, setProductos] = useState<Product[] | null>(null);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [hayFlash, setHayFlash] = useState(false);
  const [categorias, setCategorias] = useState<Category[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Page<Product>>("/catalog/products?onlyDiscounted=true&pageSize=100&sortBy=actualizados")
      .then((p) => setProductos(p.items))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    apiGet<Category[]>("/categories")
      .then(setCategorias)
      .catch(() => {});
    getPublicCombos()
      .then(setCombos)
      .catch(() => {});
    apiGet<Page<Product>>("/catalog/products?onlyFlash=true&pageSize=1")
      .then((p) => setHayFlash(p.total > 0))
      .catch(() => {});
  }, []);

  // Una tarjeta por variante con descuento, la de mayor porcentaje primero.
  const masRebajados = useMemo(() => {
    const entradas = offerVariantEntries(productos ?? [], "discount").map((e) => ({
      ...e,
      pct: descuentoPct(e.variant.finalPriceBs, Number(e.variant.isDefault ? e.product.discountBs : e.variant.discountBs)),
    }));
    return entradas.sort((a, b) => b.pct - a.pct).slice(0, REBAJADOS);
  }, [productos]);

  // Categorías raíz que tienen productos con descuento, la de más ofertas primero: «Ver todas las ofertas» abre la página de esa categoría con el
  // filtro «Productos con Descuento» ya puesto (las demás quedan como enlaces debajo de la lista).
  const categoriasConOfertas = useMemo(() => {
    const porId = new Map(categorias.map((c) => [c.id, c]));
    const raizDe = (c: Category): Category => {
      let actual = c;
      while (actual.parentId && porId.get(actual.parentId)) actual = porId.get(actual.parentId)!;
      return actual;
    };
    const conteo = new Map<string, { categoria: Category; n: number }>();
    for (const e of offerVariantEntries(productos ?? [], "discount")) {
      const raiz = raizDe(e.product.category);
      conteo.set(raiz.id, { categoria: raiz, n: (conteo.get(raiz.id)?.n ?? 0) + 1 });
    }
    return Array.from(conteo.values())
      .sort((a, b) => b.n - a.n)
      .map((x) => x.categoria);
  }, [productos, categorias]);
  const hrefOfertas = categoriasConOfertas[0] ? `/categoria/${categoriasConOfertas[0].slug}?descuento=true` : "/home#catalogo";

  return (
    <div className="landing-page">
      <LandingNavbar variant="dark" overlay={false} />

      {!campana ? (
        <section className="landing-section">
          <div className="landing-container">
            <h1 className="landing-section-title">No hay una campaña activa ahora</h1>
            <p className="landing-section-lead">Las ofertas de siempre están en el inicio.</p>
            <Link className="landing-offers-channel-btn" href="/home#catalogo">
              Ver ofertas →
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="campana-hero">
            <div className="landing-container">
              <p className="campana-hero-eyebrow">{rangoCampana(campana.inicio, campana.fin)}</p>
              <h1 className="campana-hero-titulo">{campana.nombre}</h1>
              <p className="campana-hero-texto">Perfumes árabes, de diseñador y de nicho a precios especiales. Solo por tiempo limitado y hasta agotar stock.</p>
              <div className="campana-hero-cuenta">
                <CampanaCountdown fin={campana.fin} variante="bloque" />
              </div>
              <div className="campana-hero-acciones">
                <Link className="campana-btn campana-btn--lleno" href={hrefOfertas}>
                  Comprar ahora
                </Link>
                {combos.length > 0 && (
                  <Link className="campana-btn" href="/combos">
                    Ver combos
                  </Link>
                )}
              </div>
            </div>
          </section>

          <section className="landing-section">
            <div className="landing-container">
              <div className="campana-seccion-cabecera">
                <h2 className="landing-section-title">Lo más rebajado</h2>
                <Link className="campana-ver-todo" href={hrefOfertas}>
                  Ver todas las ofertas →
                </Link>
              </div>
              {error && <p className="error-text">{error}</p>}
              {!productos && !error && <p className="landing-empty-note">Cargando...</p>}
              {productos && masRebajados.length === 0 && <p className="landing-empty-note">Pronto vas a ver aquí las mejores ofertas.</p>}
              <div className="landing-product-grid">
                {masRebajados.map((e) => (
                  <ProductCard key={e.variant.id} product={e.product} forcedVariant={e.variant} />
                ))}
              </div>
              {categoriasConOfertas.length > 1 && (
                <div className="campana-categorias">
                  <span className="campana-categorias-etiqueta">Ofertas por categoría:</span>
                  {categoriasConOfertas.map((c) => (
                    <Link key={c.id} className="landing-pill" href={`/categoria/${c.slug}?descuento=true`}>
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          {combos.length > 0 && (
            <section className="landing-section landing-section-alt">
              <div className="landing-container">
                <div className="campana-seccion-cabecera">
                  <h2 className="landing-section-title">Combos</h2>
                  <Link className="campana-ver-todo" href="/combos">
                    Ver todos →
                  </Link>
                </div>
                <div className="landing-product-grid">
                  {combos.slice(0, 4).map((combo) => (
                    <ComboCard key={combo.id} combo={combo} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {hayFlash && (
            <section className="landing-section">
              <div className="landing-container">
                <div className="campana-flash">
                  <div>
                    <p className="campana-flash-eyebrow">OFERTAS FLASH ⚡</p>
                    <p className="campana-flash-titulo">Descuentos extra con su propio cronómetro</p>
                    <p className="landing-section-lead" style={{ margin: 0 }}>Cuando se acaba el tiempo, vuelven al precio normal.</p>
                  </div>
                  <Link className="campana-btn campana-btn--lleno" href="/home#catalogo">
                    Ver ofertas flash →
                  </Link>
                </div>
              </div>
            </section>
          )}

          <div className="landing-container">
            <p className="campana-condiciones">
              Promoción válida del {rangoCampana(campana.inicio, campana.fin)} o hasta agotar stock. Los precios se muestran en bolivianos y las
              existencias son limitadas.
            </p>
          </div>
        </>
      )}

      <LandingFooter />
    </div>
  );
}
