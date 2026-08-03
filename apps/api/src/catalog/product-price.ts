import { Prisma } from "@app/database";

type ProductWithCosts<T extends { purchasePrice: Prisma.Decimal; utility: Prisma.Decimal }> = T & {
  category: { logisticsCost: Prisma.Decimal | null; shippingCost: Prisma.Decimal | null; securityCost: Prisma.Decimal | null };
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/**
 * Precio $ = Precio de compra + Logística + Envío + Seguridad (de la subcategoría, en vivo) + Utilidad.
 * No se persiste: se recalcula siempre a partir de la categoría actual, así nunca queda desactualizado.
 */
export function withPrice<T extends { purchasePrice: Prisma.Decimal; utility: Prisma.Decimal }>(
  product: ProductWithCosts<T>,
) {
  const price =
    toNumber(product.purchasePrice) +
    toNumber(product.category.logisticsCost) +
    toNumber(product.category.shippingCost) +
    toNumber(product.category.securityCost) +
    toNumber(product.utility);
  return { ...product, price };
}
