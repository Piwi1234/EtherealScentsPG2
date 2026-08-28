"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useCart } from "../../lib/cart-context";
import { cardFlashUntil, cardImageUrl, displayPrice, hasDiscount, isSoldOut, productImageSrc } from "../../lib/catalog-display";
import type { Product } from "../../lib/types";
import { formatAtributosTarjeta, formatCartAtributos } from "../proformas/AtributosVisibles";
import { FlashCountdown } from "./FlashCountdown";

// Tarjeta de producto compartida por home (ofertas + colección de la semana), /categoria y /buscar —
// antes cada página inlineaba esta misma marcación por separado; se unificó acá al agregarle el botón
// de "agregar al carrito", para no repetir esa lógica en 4 lugares.
export function ProductCard({
  product,
  className = "",
  flashVariant = "pill",
}: {
  product: Product;
  className?: string;
  /** "boxes": casilleros HH/MM/SS — usado por el carrusel de "Descuento y Ofertas" del home. */
  flashVariant?: "pill" | "boxes";
}) {
  const { addItem } = useCart();
  const { bs, fromPrice, variant, discountBs } = displayPrice(product);
  const image = productImageSrc(cardImageUrl(product, variant));
  const atributos = formatAtributosTarjeta(product.attributeValues, product.variantOptionValues);
  const soldOut = isSoldOut(product);
  const codigo = variant && product.variants.length > 1 ? variant.variantCode : product.productCode;
  const flashUntil = cardFlashUntil(product);

  function handleAdd(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      key: `${product.id}:${variant?.id ?? "base"}`,
      productId: product.id,
      productSlug: product.slug,
      variantId: variant?.id ?? null,
      name: product.name,
      code: codigo,
      atributos: formatCartAtributos(product.attributeValues, product.variantOptionValues, variant?.options ?? []),
      imageUrl: image,
      unitPriceBs: bs,
    });
  }

  return (
    <Link href={`/producto/${product.slug}`} className={`landing-product-card${className ? ` ${className}` : ""}`}>
      <div className="landing-product-image-wrap">
        {image ? (
          <img className="landing-product-image" src={image} alt={product.name} />
        ) : (
          <div className="landing-product-image-placeholder">{product.name.slice(0, 1)}</div>
        )}
        {hasDiscount(product) && (
          <span className="landing-product-offer-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
              <path d="M2.5 3h2.4l2.2 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" />
            </svg>
            Oferta
          </span>
        )}
        {product.hasStock && <span className="landing-product-instock-badge">En Stock</span>}
        {!soldOut && (
          <button type="button" className="landing-product-add-btn" aria-label="Agregar al carrito" onClick={handleAdd}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1.3" />
              <circle cx="18" cy="21" r="1.3" />
              <path d="M2.5 3h2.4l2.2 12.2a2.2 2.2 0 0 0 2.2 1.8h7.9a2.2 2.2 0 0 0 2.2-1.8L21 7H6.2" />
              <path d="M15 8h4M17 6v4" />
            </svg>
          </button>
        )}
      </div>
      <div className="landing-product-body">
        {product.brand && <span className="landing-product-brand">{product.brand.name}</span>}
        <p className="landing-product-name">{product.name}</p>
        {atributos && <p className="landing-product-attrs">{atributos}</p>}
        {flashUntil && <FlashCountdown until={flashUntil} variant={flashVariant} />}
        {soldOut ? (
          <span className="landing-product-price-soldout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M6 6l12 12" />
            </svg>
            Agotado
          </span>
        ) : discountBs > 0 ? (
          <span className="landing-product-price landing-product-price--discounted">
            <span className="landing-product-price-old">Bs {(bs + discountBs).toFixed(2)}</span>
            <span className="landing-product-price-new">
              {fromPrice ? "Desde " : ""}Bs {bs.toFixed(2)}
            </span>
          </span>
        ) : (
          <span className="landing-product-price">
            {fromPrice ? "Desde " : ""}Bs {bs.toFixed(2)}
          </span>
        )}
      </div>
    </Link>
  );
}
