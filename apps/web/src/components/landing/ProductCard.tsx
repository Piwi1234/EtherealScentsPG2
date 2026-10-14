"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useCart } from "../../lib/cart-context";
import {
  cardFlashUntil,
  cardImageUrl,
  displayPrice,
  flashUntilFor,
  formatPriceBs,
  hasDiscount,
  isPreventa,
  isSoldOut,
  productImageSrc,
  type OfferContext,
} from "../../lib/catalog-display";
import type { Product, ProductVariant } from "../../lib/types";
import { formatAtributosTarjeta, formatCartAtributos } from "../proformas/AtributosVisibles";
import { FlashCountdown } from "./FlashCountdown";

// Tarjeta de producto compartida por home (ofertas + colección de la semana), /categoria y /buscar —
// antes cada página inlineaba esta misma marcación por separado; se unificó acá al agregarle el botón
// de "agregar al carrito", para no repetir esa lógica en 4 lugares.
export function ProductCard({
  product,
  className = "",
  flashVariant = "pill",
  context,
  forcedVariant,
}: {
  product: Product;
  className?: string;
  /** "boxes": casilleros HH/MM/SS — usado por el carrusel de "Descuento y Ofertas" del home. */
  flashVariant?: "pill" | "boxes";
  /** Carrusel de "Descuento y Ofertas" del home: qué modo está activo ahora mismo. La tarjeta
   * entonces muestra precio/imagen de la variante que calificó para ese modo (ver displayPrice) y
   * lleva esa variante como query al link del producto, para que la página de detalle la abra
   * preseleccionada en vez de la más barata a secas. */
  context?: OfferContext;
  /** Si viene, la tarjeta representa ESTA variante puntual (precio, imagen, atributos, badges) en
   * vez de que ProductCard resuelva sola cuál mostrar — usado cuando un producto tiene más de una
   * variante calificando para `context` (ver offerVariantEntries): ahí sale una tarjeta por cada
   * una, no una sola por producto. */
  forcedVariant?: ProductVariant;
}) {
  const { addItem, removeItem, setQty, items } = useCart();
  const { bs, fromPrice, variant, discountBs } = forcedVariant
    ? {
        bs: forcedVariant.finalPriceBs,
        fromPrice: false,
        variant: forcedVariant,
        discountBs: Number(forcedVariant.discountBs),
      }
    : displayPrice(product, context);
  const image = productImageSrc(cardImageUrl(product, variant));
  // Con forcedVariant, solo el valor de ESA variante (ej. "200 ML") — si no, dos tarjetas del mismo
  // producto se verían con el mismo texto ("100 ML, 200 ML" las dos), que es lo que muestra
  // formatAtributosTarjeta por default (todos los tamaños disponibles, pensado para una sola
  // tarjeta por producto).
  const atributos = forcedVariant
    ? formatCartAtributos(product.attributeValues, product.variantOptionValues, forcedVariant.options)
    : formatAtributosTarjeta(product.attributeValues, product.variantOptionValues);
  const soldOut = isSoldOut(product);
  const preventa = forcedVariant ? forcedVariant.estado === "PREVENTA" : isPreventa(product);
  const codigo = variant && product.variants.length > 1 ? variant.variantCode : product.productCode;
  const flashUntil = forcedVariant ? flashUntilFor(product, forcedVariant) : cardFlashUntil(product);
  const hasOffer = forcedVariant ? discountBs > 0 : hasDiscount(product);
  const inStock = forcedVariant ? forcedVariant.hasStock : product.hasStock;

  // Misma key que usa CartItem para acumular cantidad (ver cart-context.tsx) — de acá sale cuánto ya
  // hay en el carrito de ESTA variante puntual, para decidir si la franja de abajo muestra "Agregar
  // al carrito" o el selector +/-.
  const cartKey = `${product.id}:${variant?.id ?? "base"}`;
  const qtyInCart = items.find((i) => i.key === cartKey)?.qty ?? 0;
  // Con más de una variante (sea cual sea su disponibilidad — incluso si alguna está NO_DISPONIBLE y
  // otras no) no hay una sola variante obvia para agregar directo: la franja muestra "Ver opciones"
  // en vez de "Agregar al carrito"/+-, y lleva a la ficha del producto a elegir. forcedVariant queda
  // afuera a propósito: esa tarjeta ya representa una variante puntual (ver el comentario de la prop,
  // más arriba), no hay nada que "elegir".
  const showVerOpciones = !forcedVariant && product.variants.length > 1;

  function handleAdd(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      key: cartKey,
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

  function handleDecrement(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (qtyInCart <= 1) removeItem(cartKey);
    else setQty(cartKey, qtyInCart - 1);
  }

  const href = context && variant ? `/producto/${product.slug}?variante=${variant.id}` : `/producto/${product.slug}`;

  return (
    <Link href={href} className={`landing-product-card${className ? ` ${className}` : ""}`}>
      <div className="landing-product-image-wrap">
        {image ? (
          <img className="landing-product-image" src={image} alt={product.name} />
        ) : (
          <div className="landing-product-image-placeholder">{product.name.slice(0, 1)}</div>
        )}
        {hasOffer && (
          <span className="landing-product-offer-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" />
              <path d="M2.5 3h2.4l2.2 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" />
            </svg>
            Oferta
          </span>
        )}
        {preventa ? (
          <span className="landing-product-preventa-badge">Preventa</span>
        ) : (
          inStock && <span className="landing-product-instock-badge">En Stock</span>
        )}
        {!soldOut && showVerOpciones && (
          <div className="landing-product-cart-control">
            <span className="landing-product-cart-add">
              <svg
                className="landing-product-cart-mobile-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <span className="landing-product-cart-add-text">Ver opciones</span>
            </span>
          </div>
        )}
        {!soldOut && !showVerOpciones && (
          <div
            className={`landing-product-cart-control${qtyInCart > 0 ? " landing-product-cart-control--active" : ""}`}
          >
            {qtyInCart === 0 ? (
              <button type="button" className="landing-product-cart-add" onClick={handleAdd}>
                <svg
                  className="landing-product-cart-mobile-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 2h2l2.68 12.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L22 6H6" />
                  <circle cx="9" cy="21" r="1.4" fill="currentColor" stroke="none" />
                  <circle cx="19" cy="21" r="1.4" fill="currentColor" stroke="none" />
                </svg>
                <span className="landing-product-cart-add-text">Agregar al carrito</span>
              </button>
            ) : (
              <div className="landing-product-cart-qty">
                <button
                  type="button"
                  className="landing-product-cart-qty-btn"
                  aria-label={qtyInCart > 1 ? "Quitar uno" : "Quitar del carrito"}
                  onClick={handleDecrement}
                >
                  {qtyInCart > 1 ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
                    </svg>
                  )}
                </button>
                <span className="landing-product-cart-qty-num" key={qtyInCart}>
                  {qtyInCart}
                </span>
                <button type="button" className="landing-product-cart-qty-btn" aria-label="Agregar uno" onClick={handleAdd}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="landing-product-body">
        {product.brand && <span className="landing-product-brand">{product.brand.name}</span>}
        <p className="landing-product-name">{product.name}</p>
        {atributos && <p className="landing-product-attrs">{atributos}</p>}
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
            <span className="landing-product-price-old">Bs {formatPriceBs(bs + discountBs)}</span>
            <span className="landing-product-price-new">
              {fromPrice ? "Desde " : ""}Bs {formatPriceBs(bs)}
            </span>
          </span>
        ) : (
          <span className="landing-product-price">
            {fromPrice ? "Desde " : ""}Bs {formatPriceBs(bs)}
          </span>
        )}
        {flashUntil && <FlashCountdown until={flashUntil} variant={flashVariant} />}
      </div>
    </Link>
  );
}
