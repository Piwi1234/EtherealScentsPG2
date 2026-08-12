import { EstadoProforma, OrigenAsignacion, Prisma } from "@app/database";

/**
 * Resuelve sola la Procura pendiente de OTRAS proformas de VENTA ya aprobadas para una misma
 * variante+almacén, por orden de aprobación (más antigua primero) — reparte `disponible` unidades
 * recién liberadas/llegadas entre ellas, tomando de cada una lo que necesita hasta agotar `disponible`
 * o hasta cubrir toda la Procura pendiente.
 *
 * Dos disparadores comparten esta lógica: completar una COMPRA (llega stock físico nuevo) y anular una
 * VENTA aprobada (se libera una reserva existente, sin tocar el stock físico). En ambos casos el
 * efecto es el mismo desde el punto de vista de "cuánto queda disponible para repartir".
 */
export async function resolverProcuraPendiente(
  tx: Prisma.TransactionClient,
  params: { varianteId: string; almacenId: string; disponible: number; excluirProformaId?: string },
): Promise<void> {
  let disponible = params.disponible;
  if (disponible <= 0) return;

  const procurasPendientes = await tx.proformaDetalleAsignacion.findMany({
    where: {
      origen: OrigenAsignacion.PROCURA,
      cantidad: { gt: 0 },
      proformaDetalle: {
        varianteId: params.varianteId,
        proforma: {
          almacenId: params.almacenId,
          estado: EstadoProforma.APROBADA,
          ...(params.excluirProformaId ? { id: { not: params.excluirProformaId } } : {}),
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const procura of procurasPendientes) {
    if (disponible <= 0) break;
    const tomar = Math.min(disponible, procura.cantidad);

    await tx.stock.update({
      where: { varianteId_almacenId: { varianteId: params.varianteId, almacenId: params.almacenId } },
      data: { cantidadReservada: { increment: tomar } },
    });
    await tx.proformaDetalleAsignacion.update({ where: { id: procura.id }, data: { cantidad: { decrement: tomar } } });

    const stockAsignacionExistente = await tx.proformaDetalleAsignacion.findFirst({
      where: { proformaDetalleId: procura.proformaDetalleId, origen: OrigenAsignacion.STOCK },
    });
    if (stockAsignacionExistente) {
      await tx.proformaDetalleAsignacion.update({
        where: { id: stockAsignacionExistente.id },
        data: { cantidad: { increment: tomar } },
      });
    } else {
      await tx.proformaDetalleAsignacion.create({
        data: {
          proformaDetalleId: procura.proformaDetalleId,
          almacenId: params.almacenId,
          cantidad: tomar,
          origen: OrigenAsignacion.STOCK,
        },
      });
    }

    disponible -= tomar;
  }
}
