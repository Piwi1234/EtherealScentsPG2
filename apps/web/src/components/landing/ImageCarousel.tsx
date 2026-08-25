"use client";

import { useEffect, useState } from "react";
import { productImageSrc } from "../../lib/catalog-display";
import type { CarouselImage } from "../../lib/types";

/** Carrusel de una sola imagen a la vez (fade al cambiar) + flechas + autoplay — usado para el
 * fondo del Hero, el cuadro de "Producto destacado" por categoría raíz y el banner de la página de
 * categoría/subcategoría. El wrapper (`position: relative`) lo pone quien lo usa.
 *
 * Cada imagen puede traer un `url` (cargado en Grid Imágenes) al que redirige si se hace click —
 * si no tiene, queda decorativa como antes (sin click). */
export function ImageCarousel({
  images,
  alt,
  imgClassName,
  autoplayMs,
}: {
  images: CarouselImage[];
  alt: string;
  imgClassName: string;
  autoplayMs: number;
}) {
  const [slide, setSlide] = useState(0);
  const [autoKey, setAutoKey] = useState(0);

  useEffect(() => {
    setSlide(0);
    setAutoKey((k) => k + 1);
  }, [images]);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setSlide((s) => (s + 1) % images.length);
    }, autoplayMs);
    return () => clearInterval(timer);
  }, [images.length, autoKey, autoplayMs]);

  function goTo(index: number) {
    const total = images.length;
    if (total === 0) return;
    setSlide(((index % total) + total) % total);
    setAutoKey((k) => k + 1);
  }

  if (images.length === 0) return null;

  const current = images[slide];
  const img = <img key={slide} className={imgClassName} src={productImageSrc(current.imageUrl)!} alt={alt} />;

  return (
    <>
      {current.url ? (
        <a
          key={slide}
          className="landing-image-carousel-link"
          href={current.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img className={imgClassName} src={productImageSrc(current.imageUrl)!} alt={alt} />
        </a>
      ) : (
        img
      )}
      {images.length > 1 && (
        <>
          <button
            type="button"
            className="landing-image-carousel-arrow landing-image-carousel-arrow--prev"
            aria-label="Imagen anterior"
            onClick={() => goTo(slide - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="landing-image-carousel-arrow landing-image-carousel-arrow--next"
            aria-label="Siguiente imagen"
            onClick={() => goTo(slide + 1)}
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
