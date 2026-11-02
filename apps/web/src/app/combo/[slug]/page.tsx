import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiGet, ApiError } from "../../../lib/api";
import { formatPriceBs, productImageSrc } from "../../../lib/catalog-display";
import type { Combo } from "../../../lib/types";
import { SITE_ORIGIN, SITE_TITLE } from "../../layout";
import { ComboDetailClient } from "./ComboDetailClient";

async function getComboBySlug(slug: string): Promise<Combo | null> {
  try {
    return await apiGet<Combo>(`/catalog/combos/${slug}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const combo = await getComboBySlug(slug);
  if (!combo) return {};
  const title = `${combo.nombre} — Combo`;
  const description = `Bs ${formatPriceBs(combo.totalBs)} en lugar de Bs ${formatPriceBs(combo.sumaBs)} — ${combo.items.map((i) => i.producto.name).join(", ")} en ${SITE_TITLE}.`;
  const image = productImageSrc(combo.imageUrl) ?? `${SITE_ORIGIN}/og-default.png`;
  return {
    title,
    description,
    openGraph: { title, description, siteName: SITE_TITLE, locale: "es", type: "website", url: `${SITE_ORIGIN}/combo/${combo.slug}`, images: [{ url: image }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** Server Component: un combo inexistente o no publicado devuelve un 404 real. */
export default async function ComboPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const combo = await getComboBySlug(slug);
  if (!combo) notFound();
  return <ComboDetailClient combo={combo} />;
}
