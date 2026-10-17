"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "../../../lib/api";
import { brandLinkHref } from "../../../lib/catalog-display";
import type { Category, HistoriaDetalle, Page, Product } from "../../../lib/types";
import { ProductCard } from "../../../components/landing/ProductCard";

const TAKE = 4;

export function HistoriaSugerenciaSection({ historia }: { historia: HistoriaDetalle }) {
  const [productos, setProductos] = useState<Product[] | null>(null);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (historia.sugerenciaTipo === "CASA" && historia.sugerenciaBrand) {
      apiGet<Page<Product>>(`/catalog/products?brandId=${historia.sugerenciaBrand.id}&pageSize=${TAKE}&sortBy=actualizados`)
        .then((page) => {
          setProductos(page.items);
          setTotal(page.total);
        })
        .catch(() => setProductos([]));
      apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    } else if (historia.sugerenciaTipo === "INGREDIENTE" && historia.sugerenciaAttributeOption) {
      const { attribute, id } = historia.sugerenciaAttributeOption;
      const qs = `attr[${attribute.id}]=${id}`;
      apiGet<Page<Product>>(`/catalog/products?${qs}&pageSize=${TAKE}&sortBy=actualizados`)
        .then((page) => {
          setProductos(page.items);
          setTotal(page.total);
        })
        .catch(() => setProductos([]));
    } else if (
      (historia.sugerenciaTipo === "PERFUMES" || historia.sugerenciaTipo === "PERFUMISTA") &&
      historia.sugerenciaProductos.length > 0
    ) {
      const ids = [...historia.sugerenciaProductos].sort((a, b) => a.orden - b.orden).map((sp) => sp.productId);
      Promise.all(ids.map((id) => apiGet<Product>(`/catalog/products/${id}`).catch(() => null))).then((results) => {
        const found = results.filter((p): p is Product => p !== null);
        setProductos(found);
        setTotal(found.length);
      });
    } else {
      setProductos([]);
    }
  }, [historia]);

  if (!historia.sugerenciaTipo || !productos || productos.length === 0) return null;

  let eyebrow = "";
  let titulo: string | null = null;
  let lead: string | null = null;
  let verMasHref: string | null = null;

  if (historia.sugerenciaTipo === "CASA" && historia.sugerenciaBrand) {
    const brand = historia.sugerenciaBrand;
    eyebrow = "EXPLORA LA CASA";
    titulo = `Los perfumes de ${brand.name}`;
    lead = "Las fragancias están disponibles en Ethereal Scents.";
    // Mismo criterio que weeklyCollectionRootCategory en home/page.tsx: la marca solo se asigna a
    // subcategorías, así que su raíz es el padre de la primera con la que esté asociada.
    const brandCategory = brand.categories[0]?.category ?? null;
    const rootCategory = brandCategory
      ? brandCategory.parentId
        ? (categories.find((c) => c.id === brandCategory.parentId) ?? null)
        : brandCategory
      : null;
    if (rootCategory) verMasHref = brandLinkHref(rootCategory, brand);
  } else if (historia.sugerenciaTipo === "PERFUMES") {
    eyebrow = productos.length > 1 ? "EXPLORA LAS FRAGANCIAS" : "EXPLORA LA FRAGANCIA";
    lead = "Las fragancias están disponibles en Ethereal Scents.";
  } else if (historia.sugerenciaTipo === "PERFUMISTA") {
    eyebrow = "EXPLORA SUS CREACIONES";
  } else if (historia.sugerenciaTipo === "INGREDIENTE" && historia.sugerenciaAttributeOption) {
    const option = historia.sugerenciaAttributeOption;
    eyebrow = "EXPLORA LOS AROMAS DETRÁS DE ESTA HISTORIA";
    if (total > TAKE) verMasHref = `/categoria/${option.attribute.category.slug}?attr[${option.attribute.id}]=${option.id}`;
  }

  return (
    <section className="landing-historia-chapter" style={{ background: "var(--es-bg)" }}>
      <div className="landing-container">
        <p className="landing-historia-eyebrow">
          <span className="landing-historia-eyebrow-label">{eyebrow}</span>
        </p>
        {titulo && <h2 className="landing-section-title" style={{ marginBottom: 8 }}>{titulo}</h2>}
        {lead && <p className="landing-section-lead" style={{ marginBottom: 32 }}>{lead}</p>}

        <div className="landing-product-grid">
          {productos.map((product) => (
            <ProductCard product={product} key={product.id} />
          ))}
        </div>

        {verMasHref && total > TAKE && (
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <Link href={verMasHref} className="landing-btn landing-btn-outline-dark">
              Ver más
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
