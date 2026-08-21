import { API_ORIGIN } from "./api";
import type { Attribute, Product, ProductVariant } from "./types";

export function productImageSrc(imageUrl: string | null): string | null {
  return imageUrl ? `${API_ORIGIN}${imageUrl}` : null;
}

/**
 * Si el producto tiene variantes con precio propio, se muestra "Desde" el precio más bajo entre
 * ellas — devuelve también esa variante (`variant`), para poder usar su imagen propia si tiene
 * (ver `cardImageUrl`); si no hay variantes, `variant` es null.
 */
export function displayPrice(product: Product): { bs: number; usd: number; fromPrice: boolean; variant: ProductVariant | null } {
  if (product.variants.length > 0) {
    const cheapest = product.variants.reduce((min, v) => (v.finalPriceBs < min.finalPriceBs ? v : min), product.variants[0]);
    return { bs: cheapest.finalPriceBs, usd: cheapest.price, fromPrice: product.variants.length > 1, variant: cheapest };
  }
  return { bs: product.finalPriceBs, usd: product.price, fromPrice: false, variant: null };
}

/** Imagen de tarjeta: la propia de la variante (más barata) si está cargada, si no la del producto. */
export function cardImageUrl(product: Product, variant: ProductVariant | null): string | null {
  return variant?.imageUrl ?? product.imageUrl;
}

export type AttributeDetail = { key: string; nombre: string; valor: string; orden: number };

/**
 * Todos los atributos con valor del producto (a diferencia de `AtributosVisibles`/
 * `formatAtributosVisibles`, que solo trae los marcados mostrarEnProforma) — para la sección
 * "Detalles" de la página de producto, donde sí interesa mostrar la ficha completa. Excluye a
 * propósito los de precio propio (MULTI_VALUE no, esos sí se listan; PRICED_VARIANT no, esos ya se
 * muestran como los botones de variante).
 */
export function getAllAttributeDetails(product: Product): AttributeDetail[] {
  const porAtributo = new Map<string, AttributeDetail>();

  for (const pv of product.attributeValues) {
    const valor = pv.option
      ? pv.option.value
      : pv.valueText !== null
        ? pv.valueText
        : pv.valueNumber !== null
          ? pv.valueNumber
          : pv.valueBoolean !== null
            ? pv.valueBoolean
              ? "Sí"
              : "No"
            : "—";
    porAtributo.set(pv.attributeId, { key: pv.attributeId, nombre: pv.attribute.name, valor, orden: pv.attribute.orden });
  }

  for (const v of product.variantOptionValues) {
    if (v.attribute.variantMode !== "MULTI_VALUE") continue;
    const existing = porAtributo.get(v.attributeId);
    if (existing) existing.valor = `${existing.valor}, ${v.value}`;
    else porAtributo.set(v.attributeId, { key: v.attributeId, nombre: v.attribute.name, valor: v.value, orden: v.attribute.orden });
  }

  return Array.from(porAtributo.values()).sort((a, b) => a.orden - b.orden);
}

export type AttributeFilterOption = { value: string; label: string; color: string | null };

/**
 * Valores posibles de un atributo filtrable, para armar sus checkboxes en el sidebar del catálogo.
 * - SELECT sin variante: la lista compartida de AttributeOption (canónica, no depende de qué haya
 *   cargado en la página actual de productos) — `value` es el optionId, como espera el backend.
 * - Cualquier otro caso filtrable (MULTI_VALUE, TEXT/NUMBER/BOOLEAN): no hay lista compartida, se
 *   derivan los valores distintos presentes entre los productos ya cargados.
 */
export function getAttributeFilterOptions(attribute: Attribute, products: Product[]): AttributeFilterOption[] {
  if (attribute.type === "SELECT" && attribute.variantMode === "NONE") {
    return attribute.options.map((option) => ({ value: option.id, label: option.value, color: option.color }));
  }

  if (attribute.variantMode === "MULTI_VALUE") {
    const seen = new Map<string, AttributeFilterOption>();
    for (const product of products) {
      for (const ov of product.variantOptionValues) {
        if (ov.attributeId === attribute.id) seen.set(ov.value, { value: ov.value, label: ov.value, color: null });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  // TEXT / NUMBER / BOOLEAN sin variante.
  const seen = new Map<string, AttributeFilterOption>();
  for (const product of products) {
    for (const av of product.attributeValues) {
      if (av.attributeId !== attribute.id) continue;
      if (attribute.type === "BOOLEAN" && av.valueBoolean !== null) {
        const raw = String(av.valueBoolean);
        seen.set(raw, { value: raw, label: av.valueBoolean ? "Sí" : "No", color: null });
      } else if (attribute.type === "NUMBER" && av.valueNumber !== null) {
        seen.set(av.valueNumber, { value: av.valueNumber, label: av.valueNumber, color: null });
      } else if (attribute.type === "TEXT" && av.valueText) {
        seen.set(av.valueText, { value: av.valueText, label: av.valueText, color: null });
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
}
