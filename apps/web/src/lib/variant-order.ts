import type { ProductVariant } from "./types";

/** Etiqueta de una variante con precio propio: sus valores de opción ("50 ML", "100 ML"...). */
export function variantLabel(variant: ProductVariant): string {
  return variant.options.map((o) => o.optionValue.value).join(" ");
}

/**
 * Variantes con precio propio siempre en orden alfabético por su combinación. El orden es "natural" (numeric): "50 ML"
 * va antes que "100 ML" y "Sabor 2" antes que "Sabor 10", en vez del orden estricto de caracteres ("100" antes que "50").
 */
export function ordenarVariantes<T extends ProductVariant>(variants: T[]): T[] {
  return [...variants].sort(
    (a, b) => variantLabel(a).localeCompare(variantLabel(b), "es", { numeric: true, sensitivity: "base" }) || a.variantCode.localeCompare(b.variantCode),
  );
}
