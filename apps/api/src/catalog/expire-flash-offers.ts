import { PrismaService } from "../common/prisma.service";

/**
 * Al vencerse el temporizador de Oferta Flash de un producto o variante, su descuento vuelve a 0 —
 * si no, el precio se quedaría mostrando el descuento de la oferta ya terminada para siempre.
 *
 * Sin cron: se hace un "sweep" barato (2 updateMany, solo tocan filas realmente vencidas) al
 * principio de cada lectura de catálogo (browse.service.ts y product.service.ts), así el precio
 * siempre está al día sin necesitar infraestructura de jobs nueva.
 */
export async function expireFlashOffers(prisma: PrismaService): Promise<void> {
  const now = new Date();
  await Promise.all([
    prisma.product.updateMany({
      where: { ofertaFlashHasta: { lt: now } },
      data: { ofertaFlashHasta: null, discountBs: 0 },
    }),
    prisma.productVariant.updateMany({
      where: { ofertaFlashHasta: { lt: now } },
      data: { ofertaFlashHasta: null, discountBs: 0 },
    }),
  ]);
}
