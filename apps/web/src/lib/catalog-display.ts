import { API_ORIGIN } from "./api";
import type { Product } from "./types";

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
