"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "../../../lib/cart-context";
import { displayPrice, flashUntilFor, getAllAttributeDetails, productImageSrc } from "../../../lib/catalog-display";
import type { Category, Product } from "../../../lib/types";
import { LandingNavbar } from "../../../components/landing/LandingNavbar";
import { LandingFooter } from "../../../components/landing/LandingFooter";
import { ProductCard } from "../../../components/landing/ProductCard";
import { formatCartAtributos } from "../../../components/proformas/AtributosVisibles";
import { CartIcon } from "../../../components/landing/CartWidget";
import { FlashCountdown } from "../../../components/landing/FlashCountdown";

// Una opción del selector: el valor de una variante con precio propio (ej. "90 ML") o, en una variante de decants (ml), una de sus
// presentaciones (ej. "Decant 5 ml") — esas reemplazan al nombre de la variante ("DECANTS"), que no le dice nada al cliente.
type VariantOption = { key: string; optionValueId: string; label: string; presentacionId?: string; varianteId?: string };
type VariantGroup = { attributeId: string; attributeName: string; options: VariantOption[] };

/** Variante con la que abre la página: la más barata disponible, pero sin contar los decants (ml) si hay algún frasco — un perfume
 * se abre en el frasco, y los decants se eligen después entre sus presentaciones. */
function defaultVariantId(product: Product): string | null {
  const frascos = product.variants.filter((v) => v.unidad !== "ML" && v.estado !== "NO_DISPONIBLE");
  if (frascos.length > 0) return frascos.reduce((min, v) => (v.finalPriceBs < min.finalPriceBs ? v : min), frascos[0]).id;
  return displayPrice(product).variant?.id ?? product.variants[0]?.id ?? null;
}

/** Parte interactiva de la página de producto (selector de variante, cantidad, carrito) — el
 * producto ya viene resuelto del servidor (ver page.tsx, que hace notFound() si no existe), así
 * que acá no hay fetch ni estados de carga/404. */
export function ProductoDetailClient({
  product,
  categories,
  relatedProducts,
  initialVariantId,
}: {
  product: Product;
  categories: Category[];
  relatedProducts: Product[];
  /** Viene de ?variante= en la URL (ver page.tsx) — la tarjeta de "Descuento y Ofertas" del home ya
   * la validó/resolvió contra el producto real. Si no vino ninguna (o no matchea), se cae al default
   * de siempre: la variante más barata disponible. */
  initialVariantId: string | null;
}) {
  const { addItem } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    () => initialVariantId ?? defaultVariantId(product),
  );
  const [qty, setQty] = useState(1);
  // Presentación elegida cuando la variante es de decants (ml); null en el resto. Al abrir un decants arranca en la más barata.
  const [selectedPresentacionId, setSelectedPresentacionId] = useState<string | null>(() => {
    const inicial = product.variants.find((v) => v.id === (initialVariantId ?? defaultVariantId(product)));
    return inicial?.unidad === "ML" ? (inicial.presentaciones?.[0]?.id ?? null) : null;
  });

  // Vuelve a 1 cada vez que se cambia de variante, para no arrastrar una cantidad pensada para otra.
  useEffect(() => {
    setQty(1);
  }, [selectedVariantId]);

  // Un grupo de botones por cada atributo con precio propio (ej. "Tamaño": 50 ML / 100 ML). Si el
  // producto no tiene variantes con precio propio (solo la default, sin opciones), sale vacío.
  const variantGroups: VariantGroup[] = useMemo(() => {
    const byAttribute = new Map<string, VariantGroup>();
    for (const variant of product.variants) {
      for (const opt of variant.options) {
        const attr = opt.optionValue.attribute;
        if (!byAttribute.has(attr.id)) byAttribute.set(attr.id, { attributeId: attr.id, attributeName: attr.name, options: [] });
        const group = byAttribute.get(attr.id)!;
        if (variant.unidad === "ML" && variant.presentaciones && variant.presentaciones.length > 0) {
          // Decants: en lugar del valor de la variante, una opción por cada presentación (5 ml, 10 ml...).
          for (const p of variant.presentaciones) {
            if (!group.options.some((o) => o.presentacionId === p.id)) {
              group.options.push({ key: `pres:${p.id}`, optionValueId: opt.optionValueId, label: `Decant ${p.cantidadMl} ml`, presentacionId: p.id, varianteId: variant.id });
            }
          }
        } else if (!group.options.some((o) => o.optionValueId === opt.optionValueId && !o.presentacionId)) {
          group.options.push({ key: opt.optionValueId, optionValueId: opt.optionValueId, label: opt.optionValue.value });
        }
      }
    }
    return Array.from(byAttribute.values());
  }, [product]);

  const selectedVariant = product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0] ?? null;

  /** Variante que resultaría de elegir esta opción (dejando el resto de las selecciones actuales
   * como están) — mismo matching que `selectOption`, para poder marcar la opción como no disponible
   * sin necesidad de seleccionarla primero. */
  function findVariantForOption(attributeId: string, optionValueId: string) {
    if (!selectedVariant) return null;
    const currentSelections = new Map(selectedVariant.options.map((o) => [o.optionValue.attributeId, o.optionValueId]));
    currentSelections.set(attributeId, optionValueId);
    return (
      product.variants.find((v) => {
        const vSelections = new Map(v.options.map((o) => [o.optionValue.attributeId, o.optionValueId]));
        return Array.from(currentSelections.entries()).every(([aId, vId]) => vSelections.get(aId) === vId);
      }) ?? null
    );
  }

  function selectOption(attributeId: string, optionValueId: string) {
    const match = findVariantForOption(attributeId, optionValueId);
    if (match) {
      setSelectedVariantId(match.id);
      setSelectedPresentacionId(null);
    }
  }

  function selectPresentacion(option: VariantOption) {
    setSelectedVariantId(option.varianteId ?? null);
    setSelectedPresentacionId(option.presentacionId ?? null);
  }

  const parentCategory = product.category.parentId ? categories.find((c) => c.id === product.category.parentId) ?? null : null;
  const image = productImageSrc(selectedVariant?.imageUrl ?? product.imageUrl ?? null);
  // Variante de decants: el precio es el de la presentación elegida (la variante en sí no tiene precio propio).
  const presentacion =
    selectedVariant?.unidad === "ML" ? (selectedVariant.presentaciones?.find((p) => p.id === selectedPresentacionId) ?? selectedVariant.presentaciones?.[0] ?? null) : null;
  const priceBs = presentacion ? Number(presentacion.precioVentaBs) : selectedVariant ? selectedVariant.finalPriceBs : product.finalPriceBs;
  const discountBs = presentacion ? 0 : Number(selectedVariant ? selectedVariant.discountBs : product.discountBs);
  const estado = selectedVariant ? selectedVariant.estado : "DISPONIBLE";
  // PREVENTA cuenta como disponible para comprar/mostrar precio (ver isSoldOut en catalog-display.ts):
  // solo NO_DISPONIBLE oculta el precio y el botón de agregar al carrito.
  const disponible = estado !== "NO_DISPONIBLE";
  const preventa = estado === "PREVENTA";
  const enStock = selectedVariant ? selectedVariant.hasStock : product.hasStock;
  const codigo = product.variants.length > 1 && selectedVariant ? selectedVariant.variantCode : product.productCode;
  const detalles = getAllAttributeDetails(product);
  // "Ver similares" (-> /comparar/[slug]) exige coincidir en 3+ acordes para contar como similar (ver
  // MIN_SIMILAR_ACCORD_MATCH en browse.service.ts) — con menos de 3 acordes propios ningún candidato
  // podría nunca llegar a esa cantidad (el match no puede superar el tamaño del set más chico), así
  // que el botón no tiene sentido mostrarlo. En la práctica, solo perfumes (Vapes/Cuidado Personal no
  // tienen este atributo cargado).
  const acordesCount = product.attributeValues.filter((av) => av.attribute.name === "Acordes" && av.option).length;
  const atributos = presentacion
    ? [`Decant ${presentacion.cantidadMl} ml`, formatCartAtributos(product.attributeValues, product.variantOptionValues, [])].filter(Boolean).join(", ")
    : formatCartAtributos(product.attributeValues, product.variantOptionValues, selectedVariant?.options ?? []);
  const flashUntil = presentacion ? null : flashUntilFor(product, selectedVariant);

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
                <Link href={`/categoria/${parentCategory.slug}`}>{parentCategory.name}</Link>
                <span>/</span>
              </>
            )}
            <Link href={`/categoria/${product.category.slug}`}>{product.category.name}</Link>
            <span>/</span>
            <span className="landing-breadcrumb-current">{product.name}</span>
          </p>
        </div>
      </div>

      <section className="landing-section">
        <div className="landing-container landing-product-detail-layout">
          <div className="landing-product-detail-image-col">
            <div className="landing-product-detail-image-wrap">
              {image ? (
                <img className="landing-product-detail-image" src={image} alt={product.name} />
              ) : (
                <div className="landing-product-detail-image-placeholder">{product.name.slice(0, 1)}</div>
              )}
              {discountBs > 0 && (
                <span className="landing-product-offer-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
                    <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
                    <path d="M2.5 3h2.4l2.2 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" />
                  </svg>
                  Oferta
                </span>
              )}
            </div>
            <p className="landing-product-detail-note">
              Las imágenes son referenciales — el color o la presentación pueden variar según el lote de fabricación.
            </p>
          </div>

          <div className="landing-product-detail-info">
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
                    const isPresentacion = Boolean(option.presentacionId);
                    const isActive = isPresentacion
                      ? presentacion?.id === option.presentacionId
                      : (selectedVariant?.options.some((o) => o.optionValueId === option.optionValueId) ?? false);
                    const optionVariant = isPresentacion
                      ? (product.variants.find((v) => v.id === option.varianteId) ?? null)
                      : findVariantForOption(group.attributeId, option.optionValueId);
                    const isUnavailable = optionVariant ? optionVariant.estado === "NO_DISPONIBLE" : false;
                    return (
                      <button
                        type="button"
                        key={option.key}
                        className={`landing-product-detail-variant-btn${isActive ? " landing-product-detail-variant-btn--active" : ""}${isUnavailable ? " landing-product-detail-variant-btn--unavailable" : ""}`}
                        onClick={() => (isPresentacion ? selectPresentacion(option) : selectOption(group.attributeId, option.optionValueId))}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {disponible && (
              discountBs > 0 ? (
                <p className="landing-product-detail-price-bs landing-product-detail-price-bs--discounted">
                  <span className="landing-product-detail-price-old">Bs {(priceBs + discountBs).toFixed(2)}</span>
                  <span className="landing-product-detail-price-new">Bs {priceBs.toFixed(2)}</span>
                </p>
              ) : (
                <p className="landing-product-detail-price-bs">Bs {priceBs.toFixed(2)}</p>
              )
            )}

            <p
              className={`landing-product-detail-availability${
                preventa
                  ? " landing-product-detail-availability--preventa"
                  : !disponible
                    ? " landing-product-detail-availability--no"
                    : enStock
                      ? " landing-product-detail-availability--yes"
                      : " landing-product-detail-availability--pedido"
              }`}
            >
              {preventa ? "Preventa" : !disponible ? "No disponible" : enStock ? "En Stock" : "Disponible para pedido"}
            </p>

            {disponible && flashUntil && (
              <FlashCountdown until={flashUntil} variant="boxes" className="landing-product-detail-flash-below" />
            )}

            {disponible && (
              <div className="landing-product-detail-add-row">
                <div className="landing-product-detail-qty">
                  <button type="button" aria-label="Restar" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                    −
                  </button>
                  <span>{qty}</span>
                  <button type="button" aria-label="Sumar" onClick={() => setQty((q) => q + 1)}>
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="landing-product-detail-add-btn"
                  onClick={() =>
                    addItem(
                      {
                        key: `${product.id}:${selectedVariant?.id ?? "base"}${presentacion ? `:${presentacion.id}` : ""}`,
                        productId: product.id,
                        productSlug: product.slug,
                        variantId: selectedVariant?.id ?? null,
                        name: product.name,
                        brand: product.brand?.name ?? null,
                        code: codigo,
                        atributos,
                        imageUrl: image,
                        unitPriceBs: priceBs,
                      },
                      qty,
                    )
                  }
                >
                  <CartIcon />
                  Agregar al carrito
                </button>
              </div>
            )}

            <div className="landing-product-detail-divider" />

            <p className="landing-product-detail-block-title">Descripción</p>
            <p className="landing-product-detail-block-text">{product.name}</p>

            <div className="landing-product-detail-divider" />

            <p className="landing-product-detail-block-title">
              Categoría: <Link href={`/categoria/${product.category.slug}`}>{product.category.name}</Link>
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

            {acordesCount >= 3 && (
              <Link href={`/comparar/${product.slug}`} className="landing-btn landing-btn-outline-dark landing-product-detail-similar-btn">
                Ver similares
              </Link>
            )}
          </div>
        </div>
      </section>

      {relatedProducts.length > 0 && (
        <section className="landing-section landing-related-products">
          <div className="landing-container">
            <p className="landing-eyebrow">Seguí explorando</p>
            <h2 className="landing-section-title">También te puede gustar</h2>
            <div className="landing-product-grid">
              {relatedProducts.map((related) => (
                <ProductCard product={related} key={related.id} />
              ))}
            </div>
          </div>
        </section>
      )}

      <LandingFooter />
    </div>
  );
}
