import { API_ORIGIN } from "./api";
import type { Attribute, Product } from "./types";

export function productImageSrc(imageUrl: string | null): string | null {
  return imageUrl ? `${API_ORIGIN}${imageUrl}` : null;
}

/** Si el producto tiene variantes con precio propio, se muestra "Desde" el precio más bajo entre ellas. */
export function displayPrice(product: Product): { bs: number; usd: number; fromPrice: boolean } {
  if (product.variants.length > 0) {
    const cheapest = product.variants.reduce((min, v) => (v.finalPriceBs < min.finalPriceBs ? v : min), product.variants[0]);
    return { bs: cheapest.finalPriceBs, usd: cheapest.price, fromPrice: product.variants.length > 1 };
  }
  return { bs: product.finalPriceBs, usd: product.price, fromPrice: false };
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
