import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGet, ApiError, getHistorias } from "../../../lib/api";
import { historiaImageSrc, historiaParagraphs } from "../../../lib/historia-display";
import type { HistoriaDetalle } from "../../../lib/types";
import { SITE_ORIGIN, SITE_TITLE } from "../../layout";
import { HistoriaDetailClient } from "./HistoriaDetailClient";

async function getHistoriaBySlug(slug: string): Promise<HistoriaDetalle | null> {
  try {
    return await apiGet<HistoriaDetalle>(`/historias/slug/${slug}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const historia = await getHistoriaBySlug(slug);
  if (!historia) return {};

  const portada = historia.bloques.find((b) => b.orden === 0) ?? historia.bloques[0];
  const title = portada?.texto1 || historia.titulo;
  const description = historiaParagraphs(portada?.texto4 ?? null)[0] ?? `Una historia de ${SITE_TITLE}.`;
  const image = historiaImageSrc(portada?.imageUrl ?? null) ?? `${SITE_ORIGIN}/og-default.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: SITE_TITLE,
      locale: "es",
      type: "article",
      url: `${SITE_ORIGIN}/historias/${historia.slug}`,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

/** Server Component a propósito (ver producto/[slug]/page.tsx) — notFound() real + contenido en el
 * HTML inicial para SEO; la parte interactiva (ninguna por ahora, pero deja la puerta abierta) vive
 * en HistoriaDetailClient. */
export default async function HistoriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const historia = await getHistoriaBySlug(slug);
  if (!historia) notFound();

  // Anterior/siguiente: mismo orden manual que /historias — se resuelve acá (no en el cliente) para
  // no tener que mandar el listado completo al navegador solo por esto.
  const publicadas = await getHistorias().catch(() => []);
  const index = publicadas.findIndex((h) => h.id === historia.id);
  const anterior = index > 0 ? publicadas[index - 1] : null;
  const siguiente = index >= 0 && index < publicadas.length - 1 ? publicadas[index + 1] : null;

  return <HistoriaDetailClient historia={historia} anterior={anterior} siguiente={siguiente} />;
}
