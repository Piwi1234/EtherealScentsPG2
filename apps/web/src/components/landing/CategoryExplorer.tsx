"use client";

import { useRef } from "react";
import Link from "next/link";
import { productImageSrc } from "../../lib/catalog-display";
import type { Category } from "../../lib/types";

/**
 * Bloque "Explora por categoría" del home: una tarjeta por categoría raíz (con foto, subcategorías como etiquetas y un
 * botón "Explorar"). Reemplaza a los bloques de carrusel de cada categoría; una categoría nueva suma su tarjeta sola.
 * La foto es la imagen de esa categoría (Gestión → Grid Imágenes → Explora por categoría); sin imagen, un degradado.
 * Hasta 3 categorías las tarjetas mantienen siempre el mismo tamaño (con 1 o 2 quedan centradas); de 4 en adelante el
 * bloque pasa a carrusel con flechas.
 */
const MAX_SIN_CARRUSEL = 3;

export function CategoryExplorer({ categories }: { categories: Category[] }) {
  const raices = categories.filter((c) => c.parentId === null);
  const pista = useRef<HTMLDivElement>(null);
  if (raices.length === 0) return null;
  const carrusel = raices.length > MAX_SIN_CARRUSEL;

  function mover(direccion: 1 | -1) {
    const el = pista.current;
    if (!el) return;
    const tarjeta = el.querySelector<HTMLElement>(".landing-catx-card");
    const paso = (tarjeta?.offsetWidth ?? el.clientWidth) + 24;
    el.scrollBy({ left: direccion * paso, behavior: "smooth" });
  }

  return (
    <section id="categorias" className="landing-section">
      <div className="landing-container">
        <p className="landing-eyebrow">Explora por categoría</p>
        <h2 className="landing-section-title">Encuentra lo que buscas</h2>

        <div className="landing-catx-wrap">
          {carrusel && (
            <button type="button" className="landing-catx-arrow landing-catx-arrow--prev" aria-label="Categorías anteriores" onClick={() => mover(-1)}>
              ‹
            </button>
          )}
        <div ref={pista} className={`landing-catx-grid${carrusel ? " landing-catx-grid--carousel" : ""}`}>
          {raices.map((cat) => {
            const subcategorias = categories.filter((c) => c.parentId === cat.id);
            const imagen = cat.carouselImages[0]?.imageUrl ?? null;
            const src = imagen ? productImageSrc(imagen) : null;
            return (
              <article className="landing-catx-card" key={cat.id}>
                <Link href={`/categoria/${cat.slug}`} className="landing-catx-media" aria-label={`Ver ${cat.name}`}>
                  {src ? <img src={src} alt={cat.name} loading="lazy" /> : <span className="landing-catx-media-fallback" aria-hidden="true" />}
                  <span className="landing-catx-name">{cat.name}</span>
                </Link>
                <div className="landing-catx-body">
                  {subcategorias.length > 0 && (
                    <div className="landing-catx-tags">
                      {subcategorias.map((sub) => (
                        <Link key={sub.id} href={`/categoria/${sub.slug}`} className="landing-catx-tag">
                          {sub.name}
                        </Link>
                      ))}
                    </div>
                  )}
                  <Link href={`/categoria/${cat.slug}`} className="landing-catx-cta">
                    Explorar →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
          {carrusel && (
            <button type="button" className="landing-catx-arrow landing-catx-arrow--next" aria-label="Más categorías" onClick={() => mover(1)}>
              ›
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
