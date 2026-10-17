"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { productImageSrc } from "../../lib/catalog-display";
import type { CarouselImage } from "../../lib/types";

/** <img> normal, o <picture> con una variante mobile de abajo de `mobileMediaQuery` si la imagen
 * tiene `mobileImageUrl` cargado — si no, siempre la de desktop, como antes de este campo. El resto
 * de las props son las mismas que llevaría un <img suelto (se reenvían tal cual). */
function CarouselImg({
  image,
  mobileMediaQuery,
  ...imgProps
}: {
  image: CarouselImage;
  mobileMediaQuery: string;
} & React.ImgHTMLAttributes<HTMLImageElement>) {
  const mobileSrc = image.mobileImageUrl ? productImageSrc(image.mobileImageUrl) : null;
  if (!mobileSrc) return <img src={productImageSrc(image.imageUrl)!} {...imgProps} />;
  return (
    <picture>
      <source media={mobileMediaQuery} srcSet={mobileSrc} />
      <img src={productImageSrc(image.imageUrl)!} {...imgProps} />
    </picture>
  );
}

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
 * se re-renderiza con la imagen de cada una, así el contenido cambia junto con la foto.
 *
 * Transición: "cinta deslizante" — durante un cambio de slide se montan a la vez la ventana saliente
 * y la entrante, una al lado de la otra dentro de una tira de 200% de ancho, y se anima el transform
 * de la tira entera (ver .landing-image-carousel-track en globals.css). Así ninguna de las dos
 * desaparece de golpe: se ve como una cinta de carrusel real moviéndose, no un corte. Mientras dura
 * esa animación (600ms) se ignoran nuevos goTo (clicks/swipe/autoplay) para no pisarla a mitad de
 * camino — animatingRef + currentRef viven fuera de React state porque el autoplay (setInterval) y
 * los handlers de touch necesitan leer el valor más fresco posible, no uno capturado en el cierre del
 * efecto/callback. */
export function ImageCarousel({
  images,
  alt,
  imgClassName,
  autoplayMs,
  renderOverlay,
  visibleCount = 1,
  mobileMediaQuery = "(max-width: 1000px)",
}: {
  images: CarouselImage[];
  alt: string;
  imgClassName: string;
  autoplayMs: number;
  renderOverlay?: (image: CarouselImage) => ReactNode;
  visibleCount?: number;
  /** A partir de qué media query se usa `mobileImageUrl` (si la imagen la tiene cargada) en vez de
   * la de desktop — 1000px por default (cubre una ventana a "media pantalla" en monitores comunes,
   * no solo el ancho real de un celular), para que el recorte panorámico no se estire de más antes
   * de pasar al encuadre mobile. */
  mobileMediaQuery?: string;
}) {
  const [current, setCurrent] = useState(0);
  // Transición en curso (null = en reposo). `dir` decide el sentido del recorrido de la tira: 1 =
  // avanza (autoplay, "next"), -1 = retrocede ("prev"). Ver doc de arriba.
  const [anim, setAnim] = useState<{ target: number; dir: 1 | -1 } | null>(null);
  const [autoKey, setAutoKey] = useState(0);
  const currentRef = useRef(0);
  const animatingRef = useRef(false);

  // Columnas: siempre `visibleCount`, fijo — no se achica aunque haya menos imágenes que columnas
  // (ver doc de arriba). `shown`, en cambio, sí está acotado por cuántas imágenes hay: es lo que
  // realmente se dibuja en la ventana deslizante.
  const columns = Math.max(1, Math.round(visibleCount));
  const shown = Math.max(1, Math.min(columns, images.length));

  useEffect(() => {
    currentRef.current = 0;
    animatingRef.current = false;
    setCurrent(0);
    setAnim(null);
    setAutoKey((k) => k + 1);
  }, [images]);

  useEffect(() => {
    if (images.length <= shown) return;
    const timer = setInterval(() => {
      if (animatingRef.current) return;
      goTo(currentRef.current + 1, 1);
    }, autoplayMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, shown, autoKey, autoplayMs]);

  function goTo(index: number, dir?: 1 | -1) {
    const total = images.length;
    if (total === 0 || animatingRef.current) return;
    const from = currentRef.current;
    const target = ((index % total) + total) % total;
    if (target === from) return;
    animatingRef.current = true;
    setAnim({ target, dir: dir ?? (target >= from ? 1 : -1) });
    setAutoKey((k) => k + 1);
  }

  function finishTransition(target: number) {
    currentRef.current = target;
    animatingRef.current = false;
    setCurrent(target);
    setAnim(null);
  }

  // Swipe táctil (mobile) — se guarda solo el X inicial en touchstart y se compara contra el X final
  // en touchend (sin tocar touchmove/preventDefault), así un swipe horizontal navega el carrusel sin
  // pelearse con el scroll vertical nativo de la página.
  const touchStartXRef = useRef<number | null>(null);
  const SWIPE_THRESHOLD_PX = 40;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null) return;
    const deltaX = e.changedTouches[0].clientX - startX;
    if (deltaX <= -SWIPE_THRESHOLD_PX) goTo(currentRef.current + 1, 1);
    else if (deltaX >= SWIPE_THRESHOLD_PX) goTo(currentRef.current - 1, -1);
  }

  if (images.length === 0) return null;

  const hasNav = images.length > shown;
  // Para resaltar el punto activo: el destino (no el que todavía se está viendo) así el feedback del
  // click es instantáneo, aunque la cinta tarde 600ms en terminar de moverse — mismo criterio que
  // tenía el código anterior (el slide "actual" cambiaba apenas se hacía click, antes de animar).
  const displaySlide = anim ? anim.target : current;

  function renderWindow(index: number): ReactNode {
    if (columns > 1) {
      const visible = Array.from({ length: shown }, (_, i) => images[(index + i) % images.length]);
      return (
        <div
          className="landing-image-carousel-grid"
          style={{ "--landing-carousel-columns": columns } as React.CSSProperties}
        >
          {visible.map((image) => (
            <div key={image.id} className="landing-image-carousel-grid-item">
              <CarouselImg image={image} mobileMediaQuery={mobileMediaQuery} className={imgClassName} alt={alt} />
              {renderOverlay ? renderOverlay(image) : null}
            </div>
          ))}
        </div>
      );
    }

    const image = images[index];
    const img = <CarouselImg image={image} mobileMediaQuery={mobileMediaQuery} className={imgClassName} alt={alt} />;
    return (
      <>
        {image.url ? (
          <a className="landing-image-carousel-link" href={image.url}>
            {img}
          </a>
        ) : (
          img
        )}
        {renderOverlay ? renderOverlay(image) : null}
      </>
    );
  }

  return (
    <>
      <div className="landing-image-carousel-viewport" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {anim ? (
          <div
            key={`${anim.target}-${anim.dir}`}
            className={`landing-image-carousel-track landing-image-carousel-track--${anim.dir === 1 ? "next" : "prev"}`}
            onAnimationEnd={() => finishTransition(anim.target)}
          >
            <div className="landing-image-carousel-pane">{renderWindow(anim.dir === 1 ? current : anim.target)}</div>
            <div className="landing-image-carousel-pane">{renderWindow(anim.dir === 1 ? anim.target : current)}</div>
          </div>
        ) : (
          renderWindow(current)
        )}
      </div>
      {hasNav && (
        <>
          <button
            type="button"
            className="landing-image-carousel-arrow landing-image-carousel-arrow--prev"
            aria-label={columns > 1 ? "Anterior" : "Imagen anterior"}
            onClick={() => goTo(displaySlide - 1, -1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="landing-image-carousel-arrow landing-image-carousel-arrow--next"
            aria-label={columns > 1 ? "Siguiente" : "Siguiente imagen"}
            onClick={() => goTo(displaySlide + 1, 1)}
          >
            ›
          </button>
          <div className={`landing-image-carousel-dots${columns > 1 ? " landing-image-carousel-dots--outside" : ""}`}>
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`landing-image-carousel-dot${i === displaySlide ? " landing-image-carousel-dot--active" : ""}`}
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
