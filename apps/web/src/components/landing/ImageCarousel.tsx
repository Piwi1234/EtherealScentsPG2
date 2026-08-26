"use client";

import { useEffect, useState, type ReactNode } from "react";
import { productImageSrc } from "../../lib/catalog-display";
import type { CarouselImage } from "../../lib/types";

/** Carrusel de imágenes + flechas + autoplay — usado para el fondo del Hero, el cuadro de "Producto
 * destacado" por categoría raíz y el banner de la página de categoría/subcategoría. El wrapper
 * (`position: relative`) lo pone quien lo usa.
 *
 * `visibleCount` (default 1): cuántas imágenes se muestran a la vez lado a lado (ventana deslizante
 * — avanza de a una, no de a grupos). Con 1 (el modo de siempre) es una sola imagen a pantalla
 * completa; con más, cada una queda en su propia columna dentro de una grilla, con su propio link/
 * overlay — como el carrusel de 3 banners de agatres.co.
 *
 * Cada imagen puede traer un `url` (cargado en Grid Imágenes) al que redirige si se hace click —
 * si no tiene, queda decorativa como antes (sin click), salvo que se pase `fallbackHref`: ahí SIEMPRE
 * queda clickeable (usa el `url` de la imagen si lo tiene, si no cae a ese link por default). Usado
 * por el bloque "Producto destacado" para que la tarjeta entera lleve siempre a la categoría, aunque
 * esa imagen puntual no tenga un link propio cargado.
 *
 * `renderOverlay` deja superponer contenido propio sobre cada imagen (ej. título/subtítulo) — se
 * re-renderiza con la imagen de cada una, así el contenido cambia junto con la foto. */
export function ImageCarousel({
  images,
  alt,
  imgClassName,
  autoplayMs,
  fallbackHref,
  renderOverlay,
  visibleCount = 1,
}: {
  images: CarouselImage[];
  alt: string;
  imgClassName: string;
  autoplayMs: number;
  fallbackHref?: string;
  renderOverlay?: (image: CarouselImage) => ReactNode;
  visibleCount?: number;
}) {
  const [slide, setSlide] = useState(0);
  const [autoKey, setAutoKey] = useState(0);
  // Sentido de la transición: 1 = la imagen entra desde la derecha (avanza, como "next" o el
  // autoplay), -1 = entra desde la izquierda ("prev"). Ver landing-image-carousel-slide-next/-prev.
  const [direction, setDirection] = useState<1 | -1>(1);

  useEffect(() => {
    setSlide(0);
    setAutoKey((k) => k + 1);
  }, [images]);

  const windowSize = Math.max(1, Math.min(visibleCount, images.length));

  useEffect(() => {
    if (images.length <= windowSize) return;
    const timer = setInterval(() => {
      setDirection(1);
      setSlide((s) => (s + 1) % images.length);
    }, autoplayMs);
    return () => clearInterval(timer);
  }, [images.length, windowSize, autoKey, autoplayMs]);

  function goTo(index: number, dir?: 1 | -1) {
    const total = images.length;
    if (total === 0) return;
    const nextSlide = ((index % total) + total) % total;
    setDirection(dir ?? (nextSlide >= slide ? 1 : -1));
    setSlide(nextSlide);
    setAutoKey((k) => k + 1);
  }

  if (images.length === 0) return null;

  const hasNav = images.length > windowSize;

  if (windowSize > 1) {
    const visible = Array.from({ length: windowSize }, (_, i) => images[(slide + i) % images.length]);
    return (
      <>
        <div
          className={`landing-image-carousel-grid${
            direction === 1 ? " landing-image-carousel-grid--next" : " landing-image-carousel-grid--prev"
          }`}
          style={
            {
              "--landing-carousel-columns": windowSize,
              "--landing-carousel-shift": `${100 / windowSize}%`,
            } as React.CSSProperties
          }
          key={slide}
        >
          {visible.map((image) => {
            const href = image.url || fallbackHref;
            const cell = (
              <>
                <img className={imgClassName} src={productImageSrc(image.imageUrl)!} alt={alt} />
                {renderOverlay ? renderOverlay(image) : null}
              </>
            );
            return href ? (
              <a key={image.id} className="landing-image-carousel-grid-item" href={href}>
                {cell}
              </a>
            ) : (
              <div key={image.id} className="landing-image-carousel-grid-item">
                {cell}
              </div>
            );
          })}
        </div>
        {hasNav && (
          <>
            <button
              type="button"
              className="landing-image-carousel-arrow landing-image-carousel-arrow--prev"
              aria-label="Anterior"
              onClick={() => goTo(slide - 1, -1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="landing-image-carousel-arrow landing-image-carousel-arrow--next"
              aria-label="Siguiente"
              onClick={() => goTo(slide + 1, 1)}
            >
              ›
            </button>
          </>
        )}
      </>
    );
  }

  const current = images[slide];
  const slideClassName = `${imgClassName} ${direction === 1 ? "landing-image-carousel-slide-next" : "landing-image-carousel-slide-prev"}`;
  const href = current.url || fallbackHref;
  const overlay = renderOverlay ? renderOverlay(current) : null;
  const img = <img key={slide} className={slideClassName} src={productImageSrc(current.imageUrl)!} alt={alt} />;

  return (
    <>
      {href ? (
        <a key={slide} className="landing-image-carousel-link" href={href}>
          <img className={slideClassName} src={productImageSrc(current.imageUrl)!} alt={alt} />
          {overlay}
        </a>
      ) : (
        <>
          {img}
          {overlay}
        </>
      )}
      {hasNav && (
        <>
          <button
            type="button"
            className="landing-image-carousel-arrow landing-image-carousel-arrow--prev"
            aria-label="Imagen anterior"
            onClick={() => goTo(slide - 1, -1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="landing-image-carousel-arrow landing-image-carousel-arrow--next"
            aria-label="Siguiente imagen"
            onClick={() => goTo(slide + 1, 1)}
          >
            ›
          </button>
          <div className="landing-image-carousel-dots">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`landing-image-carousel-dot${i === slide ? " landing-image-carousel-dot--active" : ""}`}
                aria-label={`Ir a la imagen ${i + 1}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
