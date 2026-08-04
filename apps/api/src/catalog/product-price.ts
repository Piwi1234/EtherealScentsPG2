import { Prisma } from "@app/database";

type CategoryCosts = {
  logisticsCost: Prisma.Decimal | null;
  shippingCost: Prisma.Decimal | null;
  securityCost: Prisma.Decimal | null;
};

type ProductWithCosts<T extends { purchasePrice: Prisma.Decimal; utility: Prisma.Decimal }> = T & {
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

/** Adjunta el precio $ calculado a cada variante con precio propio del producto. */
export function withVariantPrices<
  T extends {
    variants: { purchasePrice: Prisma.Decimal; utility: Prisma.Decimal }[];
    category: CategoryCosts;
  },
>(product: T) {
  return {
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      price: computeCatalogPrice(variant.purchasePrice, variant.utility, product.category),
    })),
  };
}

/** Adjunta el precio $ del producto y, si tiene, el de cada una de sus variantes. */
export function withPrice<
  T extends {
    purchasePrice: Prisma.Decimal;
    utility: Prisma.Decimal;
    variants: { purchasePrice: Prisma.Decimal; utility: Prisma.Decimal }[];
  },
>(product: ProductWithCosts<T>) {
  const withVariants = withVariantPrices(product);
  return { ...withVariants, price: computeCatalogPrice(product.purchasePrice, product.utility, product.category) };
}
