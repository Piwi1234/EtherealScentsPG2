import { Prisma } from "@app/database";

type ProductWithCosts<T extends { utility: Prisma.Decimal }> = T & {
  category: { logisticsCost: Prisma.Decimal | null; shippingCost: Prisma.Decimal | null; securityCost: Prisma.Decimal | null };
};

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

/**
 * Costo $ = Logística + Envío + Seguridad (de la subcategoría, en vivo) + Utilidad del producto.
 * No se persiste: se recalcula siempre a partir de la categoría actual, así nunca queda desactualizado.
 */
export function withTotalCost<T extends { utility: Prisma.Decimal }>(product: ProductWithCosts<T>) {
  const totalCost =
    toNumber(product.category.logisticsCost) +
    toNumber(product.category.shippingCost) +
    toNumber(product.category.securityCost) +
    toNumber(product.utility);
  return { ...product, totalCost };
}
