"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "../../lib/cart-context";
import { cardImageUrl, formatPriceBs, productImageSrc } from "../../lib/catalog-display";
import type { DecantItem } from "../../lib/types";
import { formatAtributosTarjeta, formatCartAtributos } from "../proformas/AtributosVisibles";

/**
 * Tarjeta de la página de decants: un perfume con sus presentaciones (2, 5, 10 ml...) como botones. Se elige el tamaño, se ve su
 * precio y se agrega al carrito sin entrar a la ficha. Una presentación sin ml suficientes sale tachada y no se puede elegir.
 */
export function DecantCard({ item }: { item: DecantItem }) {
  const { addItem, removeItem, setQty, items } = useCart();
  const { decant } = item;
  const primeraDisponible = decant.presentaciones.find((p) => p.disponible) ?? null;
  const [elegidaId, setElegidaId] = useState<string | null>(primeraDisponible?.id ?? null);
  const elegida = decant.presentaciones.find((p) => p.id === elegidaId) ?? null;

  const variante = item.variants.find((v) => v.id === decant.varianteId) ?? null;
  const image = productImageSrc(cardImageUrl(item, variante));
  const href = `/producto/${item.slug}?v=${decant.variantCode}`;
  const agotado = primeraDisponible === null;
  // Sin los tamaños del frasco (90 ML...): acá lo que se elige es el tamaño del decant.
  const atributos = formatAtributosTarjeta(item.attributeValues, []);

  const cartKey = elegida ? `${item.id}:${decant.varianteId}:${elegida.id}` : "";
  const qtyInCart = elegida ? (items.find((i) => i.key === cartKey)?.qty ?? 0) : 0;

  function agregar() {
    if (!elegida) return;
    addItem({
      key: cartKey,
      productId: item.id,
      productSlug: item.slug,
      variantId: decant.varianteId,
      name: item.name,
      brand: item.brand?.name ?? null,
      code: decant.variantCode,
      atributos: [`DECANT ${elegida.cantidadMl} ML`, formatCartAtributos(item.attributeValues, item.variantOptionValues, [])].filter(Boolean).join(", "),
      imageUrl: image,
      unitPriceBs: Number(elegida.precioVentaBs),
    });
  }

  return (
    <div className="landing-product-card landing-decant-card">
      <Link href={href} className="landing-product-image-wrap" aria-label={item.name}>
        {image ? (
          <img className="landing-product-image" src={image} alt={item.name} />
        ) : (
          <div className="landing-product-image-placeholder" />
        )}
        {!agotado && <span className="landing-product-instock-badge">En Stock</span>}
      </Link>
      <div className="landing-product-body">
        {item.brand && <span className="landing-product-brand">{item.brand.name}</span>}
        <Link href={href} className="landing-product-name landing-decant-name">
          {item.name}
        </Link>
        {atributos && <p className="landing-product-attrs">{atributos}</p>}

        <div className="landing-decant-sizes" role="group" aria-label="Tamaño del decant">
          {decant.presentaciones.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={!p.disponible}
              aria-pressed={p.id === elegidaId}
              className={`landing-decant-size${p.id === elegidaId ? " landing-decant-size--active" : ""}`}
              onClick={() => setElegidaId(p.id)}
              title={p.disponible ? `${p.cantidadMl} ml` : `${p.cantidadMl} ml: agotado`}
            >
              {p.cantidadMl} ml
            </button>
          ))}
        </div>

        {agotado ? (
          <span className="landing-product-price-soldout">Agotado</span>
        ) : (
          <>
            <span className="landing-product-price">Bs {formatPriceBs(Number(elegida?.precioVentaBs ?? decant.desdeBs))}</span>
            {qtyInCart === 0 ? (
              <button type="button" className="landing-decant-add" disabled={!elegida} onClick={agregar}>
                Agregar al carrito
              </button>
            ) : (
              <div className="landing-decant-qty">
                <button type="button" aria-label={qtyInCart > 1 ? "Quitar uno" : "Quitar del carrito"} onClick={() => (qtyInCart <= 1 ? removeItem(cartKey) : setQty(cartKey, qtyInCart - 1))}>
                  −
                </button>
                <span>{qtyInCart}</span>
                <button type="button" aria-label="Agregar uno" onClick={agregar}>
                  +
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
