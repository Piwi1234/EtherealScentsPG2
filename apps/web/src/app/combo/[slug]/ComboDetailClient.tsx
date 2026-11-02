"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "../../../lib/cart-context";
import { formatPriceBs, productImageSrc } from "../../../lib/catalog-display";
import type { Combo } from "../../../lib/types";
import { LandingNavbar } from "../../../components/landing/LandingNavbar";
import { LandingFooter } from "../../../components/landing/LandingFooter";
import { CartIcon } from "../../../components/landing/CartWidget";
import { resumenCombo } from "../../../components/landing/ComboCard";

/** Detalle de un combo: imagen, precio con el ahorro, qué trae (cada producto enlaza a su ficha) y "Agregar al carrito". */
export function ComboDetailClient({ combo }: { combo: Combo }) {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const image = productImageSrc(combo.imageUrl);

  return (
    <div className="landing-page landing-product-page">
      <LandingNavbar variant="dark" />

      <div className="landing-breadcrumb-bar">
        <div className="landing-container">
          <p className="landing-breadcrumb">
            <Link href="/home">Inicio</Link>
            <span>/</span>
            <Link href="/combos">Combos</Link>
            <span>/</span>
            <span className="landing-breadcrumb-current">{combo.nombre}</span>
          </p>
        </div>
      </div>

      <section className="landing-section">
        <div className="landing-container landing-product-detail-layout">
          <div className="landing-product-detail-image-col">
            <div className="landing-product-detail-image-wrap">
              {image ? (
                <img className="landing-product-detail-image" src={image} alt={combo.nombre} />
              ) : (
                <div className="landing-product-detail-image-placeholder">{combo.nombre.slice(0, 1)}</div>
              )}
              {combo.ahorroBs > 0 && <span className="landing-product-offer-badge">Ahorras Bs {formatPriceBs(combo.ahorroBs)}</span>}
            </div>
          </div>

          <div className="landing-product-detail-info">
            <p className="landing-product-detail-brand">Combo · {combo.category.name}</p>
            <h1 className="landing-product-detail-name">{combo.nombre}</h1>
            <p className="landing-product-detail-code">Código del combo: {combo.comboCode}</p>

            {combo.descripcion && <p className="landing-product-detail-block-text">{combo.descripcion}</p>}

            {!combo.agotado &&
              (combo.ahorroBs > 0 ? (
                <p className="landing-product-detail-price-bs landing-product-detail-price-bs--discounted">
                  <span className="landing-product-detail-price-old">Bs {combo.sumaBs.toFixed(2)}</span>
                  <span className="landing-product-detail-price-new">Bs {combo.totalBs.toFixed(2)}</span>
                </p>
              ) : (
                <p className="landing-product-detail-price-bs">Bs {combo.totalBs.toFixed(2)}</p>
              ))}

            <p
              className={`landing-product-detail-availability${
                combo.agotado ? " landing-product-detail-availability--no" : combo.preventa ? " landing-product-detail-availability--preventa" : " landing-product-detail-availability--yes"
              }`}
            >
              {combo.agotado ? "Agotado" : combo.preventa ? "Preventa" : "En Stock"}
            </p>

            {!combo.agotado && (
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
                        key: `combo:${combo.id}`,
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
            <p className="landing-product-detail-block-title">Qué trae este combo</p>
            <div className="landing-combo-items">
              {combo.items.map((item) => {
                const img = productImageSrc(item.imageUrl);
                return (
                  <Link key={item.id} href={`/producto/${item.producto.slug}`} className="landing-combo-item">
                    {img ? <img src={img} alt={item.producto.name} /> : <span className="landing-combo-item-placeholder">{item.producto.name.slice(0, 1)}</span>}
                    <span className="landing-combo-item-info">
                      {item.producto.brand && <span className="landing-combo-item-brand">{item.producto.brand.name}</span>}
                      <span className="landing-combo-item-name">
                        {item.cantidad > 1 ? `${item.cantidad}× ` : ""}
                        {item.producto.name}
                        {item.variante.etiqueta ? ` · ${item.variante.etiqueta}` : ""}
                      </span>
                    </span>
                    <span className="landing-combo-item-price">Bs {formatPriceBs(item.subtotalBs)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
