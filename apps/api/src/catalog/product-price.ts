import { Prisma } from "@app/database";

type CategoryCosts = {
  logisticsCost: Prisma.Decimal | null;
  shippingCost: Prisma.Decimal | null;
  securityCost: Prisma.Decimal | null;
};

type PriceFields = { purchasePrice: Prisma.Decimal; utility: Prisma.Decimal };
type BsPriceFields = { minPriceBs: Prisma.Decimal | null; discountBs: Prisma.Decimal };

type ProductWithCosts<T extends PriceFields> = T & {
  category: CategoryCosts;
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/**
 * Precio $ = Precio de compra + Logística + Envío + Seguridad (de la subcategoría, en vivo) + Utilidad.
 * No se persiste: se recalcula siempre a partir de la categoría actual, así nunca queda desactualizado.
 * La usan tanto Product como ProductVariant (cada variante tiene su propia purchasePrice/utility,
 * pero comparte los costos de la categoría del producto al que pertenece).
 */
export function computeCatalogPrice(
  purchasePrice: Prisma.Decimal | number,
  utility: Prisma.Decimal | number,
  category: CategoryCosts,
): number {
  return (
    toNumber(purchasePrice) +
    toNumber(category.logisticsCost) +
    toNumber(category.shippingCost) +
    toNumber(category.securityCost) +
    toNumber(utility)
  );
}

/** Precio Final Bs siempre se redondea hacia arriba al múltiplo de 10 más cercano (ej. 147 → 150). */
function roundUpToTen(value: number): number {
  return Math.ceil(value / 10) * 10;
}

/**
 * Precios en bolívares, a partir del precio $ ya calculado:
 * - Precio May Bs = precio $ * tipo de cambio del sistema, sin redondear (precio real).
 * - Precio Final Bs = (Precio Min Bs si se cargó, si no Precio May Bs sin redondear) - Descuento,
 *   redondeado hacia arriba a un múltiplo de 10 (esa sí es intencional: es el precio de venta que
 *   se le muestra al cliente).
 * Ninguno de los dos se persiste (salvo minPriceBs/discountBs, que son la entrada manual).
 */
export function computeBsPrices(priceUsd: number, bs: BsPriceFields, exchangeRate: number) {
  const wholesalePriceBs = priceUsd * exchangeRate;
  const basePriceBs = bs.minPriceBs !== null ? toNumber(bs.minPriceBs) : wholesalePriceBs;
  const finalPriceBs = roundUpToTen(basePriceBs - toNumber(bs.discountBs));
  return { wholesalePriceBs, finalPriceBs };
}

/** Adjunta el precio $ y los precios Bs calculados a cada variante con precio propio del producto. */
export function withVariantPrices<
  T extends {
    variants: (PriceFields & BsPriceFields)[];
    category: CategoryCosts;
  },
>(product: T, exchangeRate: number) {
  return {
    ...product,
    variants: product.variants.map((variant) => {
      const price = computeCatalogPrice(variant.purchasePrice, variant.utility, product.category);
      return { ...variant, price, ...computeBsPrices(price, variant, exchangeRate) };
    }),
  };
}

/** Adjunta el precio $ y los precios Bs del producto y, si tiene, los de cada una de sus variantes. */
export function withPrice<T extends PriceFields & BsPriceFields & { variants: (PriceFields & BsPriceFields)[] }>(
  product: ProductWithCosts<T>,
  exchangeRate: number,
) {
  const withVariants = withVariantPrices(product, exchangeRate);
  const price = computeCatalogPrice(product.purchasePrice, product.utility, product.category);
  return { ...withVariants, price, ...computeBsPrices(price, product, exchangeRate) };
}
