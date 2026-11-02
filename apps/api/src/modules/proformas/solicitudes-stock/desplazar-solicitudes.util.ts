import { Prisma } from "@app/database";

/** Unidades de una línea de solicitud ligada a una compra que todavía se pueden quitar: las que ya llegaron al almacén no. */
export function unidadesDesplazables(linea: { cantidad: number; cantidadRecibida: number }): number {
  return Math.max(0, linea.cantidad - linea.cantidadRecibida);
}

/**
 * Un pedido de cliente tiene prioridad sobre una solicitud de stock: cuando una línea de compra ya no tiene cupo libre, las
 * unidades que cubren solicitudes se le quitan a estas (las líneas más recientes primero) para ligarlas al pedido. Lo quitado
 * vuelve a "Sin compra" en su solicitud, con una nota que dice por qué, y se vuelve a comprar desde Seguimiento. Lo que ya llegó
 * al almacén no se toca. Corre dentro de la transacción de quien liga; esa transacción recalcula el tránsito después.
 * Devuelve cuánto se le quitó a cada solicitud.
 */
export async function desplazarSolicitudes(
  tx: Prisma.TransactionClient,
  compraDetalleId: string,
  unidades: number,
  motivo: string,
): Promise<{ codigo: string; unidades: number }[]> {
  const lineas = await tx.solicitudStockLinea.findMany({
    where: { compraDetalleId },
    include: { solicitud: { select: { codigo: true } } },
    orderBy: { createdAt: "desc" },
  });

  let restante = unidades;
  const quitado = new Map<string, number>();
  const unirNota = (nota: string | null) => (nota ? `${nota} · ${motivo}` : motivo);

  for (const linea of lineas) {
    if (restante <= 0) break;
    const toma = Math.min(unidadesDesplazables(linea), restante);
    if (toma <= 0) continue;

    // La parte quitada vuelve a la fila libre de la misma solicitud y producto (si ya hay una), o se crea.
    const libre = await tx.solicitudStockLinea.findFirst({
      where: { solicitudId: linea.solicitudId, varianteId: linea.varianteId, compraDetalleId: null, id: { not: linea.id } },
    });

    if (toma === linea.cantidad) {
      if (libre) {
        await tx.solicitudStockLinea.delete({ where: { id: linea.id } });
        await tx.solicitudStockLinea.update({ where: { id: libre.id }, data: { cantidad: { increment: toma }, nota: unirNota(libre.nota) } });
      } else {
        await tx.solicitudStockLinea.update({ where: { id: linea.id }, data: { compraDetalleId: null, nota: unirNota(linea.nota) } });
      }
    } else {
      await tx.solicitudStockLinea.update({ where: { id: linea.id }, data: { cantidad: { decrement: toma } } });
      if (libre) {
        await tx.solicitudStockLinea.update({ where: { id: libre.id }, data: { cantidad: { increment: toma }, nota: unirNota(libre.nota) } });
      } else {
        await tx.solicitudStockLinea.create({
          data: { solicitudId: linea.solicitudId, varianteId: linea.varianteId, cantidad: toma, nota: unirNota(null), compraDetalleId: null },
        });
      }
    }

    restante -= toma;
    quitado.set(linea.solicitud.codigo, (quitado.get(linea.solicitud.codigo) ?? 0) + toma);
  }

  return [...quitado.entries()].map(([codigo, n]) => ({ codigo, unidades: n }));
}
