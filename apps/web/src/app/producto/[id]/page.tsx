"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet, ApiError } from "../../../lib/api";
import { displayPrice, getAllAttributeDetails, productImageSrc } from "../../../lib/catalog-display";
import type { Category, Product } from "../../../lib/types";
import { LandingNavbar } from "../../../components/landing/LandingNavbar";
import { LandingFooter } from "../../../components/landing/LandingFooter";

type VariantGroup = { attributeId: string; attributeName: string; options: { optionValueId: string; label: string }[] };

export default function ProductoPage() {
  const { id } = useParams<{ id: string }>();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setProduct(null);
    setSelectedVariantId(null);
    setNotFound(false);
    setError("");
    apiGet<Category[]>("/categories").then(setCategories).catch(() => {});
    apiGet<Product>(`/catalog/products/${id}`)
      .then(setProduct)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : String(e));
      });
  }, [id]);

  // Por defecto se elige la variante más barata — misma convención que usan las tarjetas del catálogo.
  useEffect(() => {
    if (product) setSelectedVariantId(displayPrice(product).variant?.id ?? product.variants[0]?.id ?? null);
  }, [product]);

  // Un grupo de botones por cada atributo con precio propio (ej. "Tamaño": 50 ML / 100 ML). Si el
  // producto no tiene variantes con precio propio (solo la default, sin opciones), sale vacío.
  const variantGroups: VariantGroup[] = useMemo(() => {
    if (!product) return [];
    const byAttribute = new Map<string, VariantGroup>();
    for (const variant of product.variants) {
      for (const opt of variant.options) {
        const attr = opt.optionValue.attribute;
        if (!byAttribute.has(attr.id)) byAttribute.set(attr.id, { attributeId: attr.id, attributeName: attr.name, options: [] });
        const group = byAttribute.get(attr.id)!;
        if (!group.options.some((o) => o.optionValueId === opt.optionValueId)) {
          group.options.push({ optionValueId: opt.optionValueId, label: opt.optionValue.value });
        }
      }
    }
    return Array.from(byAttribute.values());
  }, [product]);

  const selectedVariant = product ? product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0] ?? null : null;

  function selectOption(attributeId: string, optionValueId: string) {
    if (!product || !selectedVariant) return;
    const currentSelections = new Map(selectedVariant.options.map((o) => [o.optionValue.attributeId, o.optionValueId]));
    currentSelections.set(attributeId, optionValueId);
    const match = product.variants.find((v) => {
      const vSelections = new Map(v.options.map((o) => [o.optionValue.attributeId, o.optionValueId]));
      return Array.from(currentSelections.entries()).every(([aId, vId]) => vSelections.get(aId) === vId);
    });
    if (match) setSelectedVariantId(match.id);
  }

  if (notFound) {
    return (
      <div className="landing-page landing-product-page">
        <LandingNavbar variant="dark" />
        <div className="landing-breadcrumb-bar">
          <div className="landing-container">
            <p className="landing-category-lead" style={{ margin: 0 }}>
              Producto no encontrado. <Link href="/home">Volvé al inicio</Link>.
            </p>
          </div>
        </div>
        <LandingFooter />
      </div>
    );
  }

  const parentCategory = product?.category.parentId ? categories.find((c) => c.id === product.category.parentId) ?? null : null;
  const image = productImageSrc(selectedVariant?.imageUrl ?? product?.imageUrl ?? null);
  const priceBs = selectedVariant ? selectedVariant.finalPriceBs : product?.finalPriceBs ?? 0;
  const disponible = selectedVariant ? selectedVariant.disponible : true;
  const codigo = product && product.variants.length > 1 && selectedVariant ? selectedVariant.variantCode : product?.productCode ?? "";
  const detalles = product ? getAllAttributeDetails(product) : [];

  return (
    <div className="landing-page landing-product-page">
      <LandingNavbar variant="dark" />

      <div className="landing-breadcrumb-bar">
        <div className="landing-container">
          <p className="landing-breadcrumb">
            <Link href="/home">Inicio</Link>
            <span>/</span>
            {parentCategory && (
              <>
                <Link href={`/categoria/${parentCategory.id}`}>{parentCategory.name}</Link>
                <span>/</span>
              </>
            )}
            {product && (
              <>
                <Link href={`/categoria/${product.categoryId}`}>{product.category.name}</Link>
                <span>/</span>
              </>
            )}
            <span className="landing-breadcrumb-current">{product?.name ?? "..."}</span>
          </p>
        </div>
      </div>

      <section className="landing-section">
        <div className="landing-container landing-product-detail-layout">
          <div className="landing-product-detail-image-col">
            {image ? (
              <img className="landing-product-detail-image" src={image} alt={product?.name ?? ""} />
            ) : (
              <div className="landing-product-detail-image-placeholder">{product?.name.slice(0, 1) ?? ""}</div>
            )}
            <p className="landing-product-detail-note">
              Las imágenes son referenciales — el color o la presentación pueden variar según el lote de fabricación.
            </p>
          </div>

          <div className="landing-product-detail-info">
            {error && <p className="error-text">{error}</p>}
            {!product && !error && <p className="landing-empty-note">Cargando...</p>}

            {product && (
              <>
                {product.brand && (
                  productImageSrc(product.brand.logoUrl) ? (
                    <img
                      className="landing-product-detail-brand-logo"
                      src={productImageSrc(product.brand.logoUrl)!}
                      alt={product.brand.name}
                    />
                  ) : (
                    <p className="landing-product-detail-brand">{product.brand.name}</p>
                  )
                )}
                <h1 className="landing-product-detail-name">{product.name}</h1>
                <p className="landing-product-detail-code">Código del producto: {codigo}</p>

                {variantGroups.map((group) => (
                  <div className="landing-product-detail-variant-group" key={group.attributeId}>
                    <p className="landing-product-detail-variant-label">{group.attributeName}</p>
                    <div className="landing-product-detail-variant-options">
                      {group.options.map((option) => {
                        const isActive = selectedVariant?.options.some((o) => o.optionValueId === option.optionValueId) ?? false;
                        return (
                          <button
                            type="button"
                            key={option.optionValueId}
                            className={`landing-product-detail-variant-btn${isActive ? " landing-product-detail-variant-btn--active" : ""}`}
                            onClick={() => selectOption(group.attributeId, option.optionValueId)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <p className="landing-product-detail-price-bs">Bs {priceBs.toFixed(2)}</p>

                <p className={`landing-product-detail-availability${disponible ? " landing-product-detail-availability--yes" : " landing-product-detail-availability--no"}`}>
                  {disponible ? "Disponible" : "No disponible"}
                </p>

                <div className="landing-product-detail-divider" />

                <p className="landing-product-detail-block-title">Descripción</p>
                <p className="landing-product-detail-block-text">{product.name}</p>

                <div className="landing-product-detail-divider" />

                <p className="landing-product-detail-block-title">
                  Categoría: <Link href={`/categoria/${product.categoryId}`}>{product.category.name}</Link>
                </p>

                {detalles.length > 0 && (
                  <>
                    <div className="landing-product-detail-divider" />
                    <p className="landing-product-detail-block-title">Detalles</p>
                    <div className="landing-product-detail-list">
                      {detalles.map((d) => (
                        <div className="landing-product-detail-list-row" key={d.key}>
                          <span>{d.nombre}</span>
                          <span>{d.valor}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
