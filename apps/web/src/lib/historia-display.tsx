import { Fragment, type ReactNode } from "react";
import { API_ORIGIN } from "./api";
import type { HistoriaCategoria } from "./types";

export const HISTORIA_CATEGORIA_LABELS: Record<HistoriaCategoria, string> = {
  CASAS: "Casas",
  PERFUMISTAS: "Perfumistas",
  INGREDIENTES: "Ingredientes",
  FRAGANCIAS: "Fragancias",
  APRENDE: "Aprende",
};

export function historiaImageSrc(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  return imageUrl.startsWith("http") ? imageUrl : `${API_ORIGIN}${imageUrl}`;
}

/** texto4 (cuerpo) se carga como texto libre con una línea en blanco entre párrafos — esto arma los
 * <p> que consume el detalle público. Sin texto, lista vacía (el bloque no muestra el párrafo). */
export function historiaParagraphs(texto: string | null): string[] {
  if (!texto) return [];
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Negrilla puntual dentro de un párrafo con "**así**" (estilo markdown, sin el resto de su
 * sintaxis) — se carga tal cual desde el textarea del panel, acá se convierte a <strong>. */
export function renderHistoriaInline(texto: string): ReactNode {
  const parts = texto.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>));
}

/** <img> normal, o <picture> con la variante mobile (si está cargada) debajo de 900px — mismo
 * breakpoint en el que .landing-historia-split pasa de fila a columna (ver globals.css). Sin
 * mobileImageUrl, siempre la de desktop. */
export function HistoriaBloqueImage({
  imageUrl,
  mobileImageUrl,
  alt,
  className,
}: {
  imageUrl: string | null;
  mobileImageUrl: string | null;
  alt: string;
  className: string;
}) {
  const src = historiaImageSrc(imageUrl);
  if (!src) return null;

  const mobileSrc = historiaImageSrc(mobileImageUrl);
  if (!mobileSrc) return <img className={className} src={src} alt={alt} />;

  return (
    <picture>
      <source media="(max-width: 900px)" srcSet={mobileSrc} />
      <img className={className} src={src} alt={alt} />
    </picture>
  );
}
