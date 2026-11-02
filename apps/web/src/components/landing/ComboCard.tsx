"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { useCart } from "../../lib/cart-context";
import { formatPriceBs, productImageSrc } from "../../lib/catalog-display";
import type { Combo } from "../../lib/types";

/** "2× Amber Oud (100 ML) + Evoke Gold" — los componentes del combo en una línea (tarjeta, carrito y mensaje de WhatsApp). */
export function resumenCombo(combo: Combo): string {
  return combo.items.map((i) => `${i.cantidad > 1 ? `${i.cantidad}× ` : ""}${i.producto.name}${i.variante.etiqueta ? ` (${i.variante.etiqueta})` : ""}`).join(" + ");
}

/** Tarjeta de un combo (home y /combos): misma estética que ProductCard, con el ahorro en lugar de la oferta. */
export function ComboCard({ combo, className = "" }: { combo: Combo; className?: string }) {
  const { addItem, removeItem, setQty, items } = useCart();
  const image = productImageSrc(combo.imageUrl);
  const cartKey = `combo:${combo.id}`;
  const qtyInCart = items.find((i) => i.key === cartKey)?.qty ?? 0;

  function handleAdd(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      key: cartKey,
      productId: combo.id,
      productSlug: combo.slug,
      href: `/combo/${combo.slug}`,
      variantId: null,
      name: combo.nombre,
      brand: null,
      code: combo.comboCode,
      atributos: resumenCombo(combo),
      imageUrl: image,
      unitPriceBs: combo.totalBs,
    });
  }

  function handleDecrement(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (qtyInCart <= 1) removeItem(cartKey);
    else setQty(cartKey, qtyInCart - 1);
  }

  return (
    <Link href={`/combo/${combo.slug}`} className={`landing-product-card landing-combo-card${className ? ` ${className}` : ""}`}>
      <div className="landing-product-image-wrap">
        {image ? (
          <img className="landing-product-image" src={image} alt={combo.nombre} />
        ) : (
          <div className="landing-product-image-placeholder landing-combo-placeholder">{combo.items.length} productos</div>
        )}
        {combo.ahorroBs > 0 && <span className="landing-product-offer-badge">Ahorras Bs {formatPriceBs(combo.ahorroBs)}</span>}
        {combo.preventa ? (
          <span className="landing-product-preventa-badge">Preventa</span>
        ) : (
          !combo.agotado && <span className="landing-product-instock-badge">En Stock</span>
        )}
        {!combo.agotado && (
          <div className={`landing-product-cart-control${qtyInCart > 0 ? " landing-product-cart-control--active" : ""}`}>
            {qtyInCart === 0 ? (
              <button type="button" className="landing-product-cart-add" onClick={handleAdd}>
                <svg className="landing-product-cart-mobile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 2h2l2.68 12.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L22 6H6" />
                  <circle cx="9" cy="21" r="1.4" fill="currentColor" stroke="none" />
                  <circle cx="19" cy="21" r="1.4" fill="currentColor" stroke="none" />
                </svg>
                <span className="landing-product-cart-add-text">Agregar al carrito</span>
              </button>
            ) : (
              <div className="landing-product-cart-qty">
                <button type="button" className="landing-product-cart-qty-btn" aria-label={qtyInCart > 1 ? "Quitar uno" : "Quitar del carrito"} onClick={handleDecrement}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={qtyInCart > 1 ? "M5 12h14" : "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"} />
                  </svg>
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
        <span className="landing-product-brand">Combo · {combo.category.name}</span>
        <p className="landing-product-name">{combo.nombre}</p>
        <p className="landing-product-attrs">{resumenCombo(combo)}</p>
        {combo.agotado ? (
          <span className="landing-product-price-soldout">Agotado</span>
        ) : combo.ahorroBs > 0 ? (
          <span className="landing-product-price landing-product-price--discounted">
            <span className="landing-product-price-old">Bs {formatPriceBs(combo.sumaBs)}</span>
            <span className="landing-product-price-new">Bs {formatPriceBs(combo.totalBs)}</span>
          </span>
        ) : (
          <span className="landing-product-price">Bs {formatPriceBs(combo.totalBs)}</span>
        )}
      </div>
    </Link>
  );
}
