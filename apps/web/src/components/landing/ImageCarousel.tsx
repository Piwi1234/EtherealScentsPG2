"use client";

import { useEffect, useState, type ReactNode } from "react";
import { productImageSrc } from "../../lib/catalog-display";
import type { CarouselImage } from "../../lib/types";

/** Carrusel de imágenes + flechas + autoplay — usado para el fondo del Hero, el cuadro de "Producto
 * destacado" por categoría raíz y el banner de la página de categoría/subcategoría. El wrapper
 * (`position: relative`) lo pone quien lo usa.
 *
 * `visibleCount` (default 1): cuántas columnas tiene el carrusel. Con 1 (el modo de siempre) es una
 * sola imagen a pantalla completa, clickeable si tiene `url`. Con más, siempre reserva esa cantidad
 * de columnas — aunque haya menos imágenes cargadas que columnas, no se agrandan para ocupar el
 * espacio sobrante (así no cambia el recorte entre tener 1, 2 o 3 imágenes) — como el carrusel de 3
 * banners de agatres.co. Ahí cada imagen queda decorativa por default; el click (si lo necesita) lo
 * arma quien la usa mediante `renderOverlay`, ej. un botón que solo aparece si esa imagen tiene `url`.
 *
 * `renderOverlay` deja superponer contenido propio sobre cada imagen (ej. título/subtítulo/botón) —
 * se re-renderiza con la imagen de cada una, así el contenido cambia junto con la foto. */
export function ImageCarousel({
  images,
  alt,
  imgClassName,
  autoplayMs,
  renderOverlay,
  visibleCount = 1,
}: {
  images: CarouselImage[];
  alt: string;
  imgClassName: string;
  autoplayMs: number;
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

  // Columnas: siempre `visibleCount`, fijo — no se achica aunque haya menos imágenes que columnas
  // (ver doc de arriba). `shown`, en cambio, sí está acotado por cuántas imágenes hay: es lo que
  // realmente se dibuja en la ventana deslizante.
  const columns = Math.max(1, Math.round(visibleCount));
  const shown = Math.max(1, Math.min(columns, images.length));

  useEffect(() => {
    if (images.length <= shown) return;
    const timer = setInterval(() => {
      setDirection(1);
      setSlide((s) => (s + 1) % images.length);
    }, autoplayMs);
    return () => clearInterval(timer);
  }, [images.length, shown, autoKey, autoplayMs]);

  function goTo(index: number, dir?: 1 | -1) {
    const total = images.length;
    if (total === 0) return;
    const nextSlide = ((index % total) + total) % total;
    setDirection(dir ?? (nextSlide >= slide ? 1 : -1));
    setSlide(nextSlide);
    setAutoKey((k) => k + 1);
  }

  if (images.length === 0) return null;

  const hasNav = images.length > shown;

  if (columns > 1) {
    const visible = Array.from({ length: shown }, (_, i) => images[(slide + i) % images.length]);
    return (
      <>
        <div
          className={`landing-image-carousel-grid${
            direction === 1 ? " landing-image-carousel-grid--next" : " landing-image-carousel-grid--prev"
          }`}
          style={
            {
              "--landing-carousel-columns": columns,
              "--landing-carousel-shift": `${100 / columns}%`,
            } as React.CSSProperties
          }
          key={slide}
        >
          {visible.map((image) => (
            <div key={image.id} className="landing-image-carousel-grid-item">
              <img className={imgClassName} src={productImageSrc(image.imageUrl)!} alt={alt} />
              {renderOverlay ? renderOverlay(image) : null}
            </div>
          ))}
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
            {/* Fuera de la grilla (no superpuestos a las imágenes como en el modo de 1 sola) — van
                debajo, centrados. */}
            <div className="landing-image-carousel-dots landing-image-carousel-dots--outside">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`landing-image-carousel-dot${i === slide ? " landing-image-carousel-dot--active" : ""}`}
                  aria-label={`Ir a la posición ${i + 1}`}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  const current = images[slide];
  const slideClassName = `${imgClassName} ${direction === 1 ? "landing-image-carousel-slide-next" : "landing-image-carousel-slide-prev"}`;
  const href = current.url;
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
