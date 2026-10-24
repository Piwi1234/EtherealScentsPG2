import { EstadoProforma, OrigenAsignacion, Prisma } from "@app/database";

/**
 * Stock "en tránsito": unidades "para stock" de compras cuyo envío ya salió (EN_TRANSITO) hacia un
 * almacén. Todavía no son físicas: una venta aprobada puede reservarlas por adelantado
 * (asignación EN_TRANSITO) pero no se puede completar hasta que lleguen (ver
 * proforma-completion.service.ts). Todas las funciones asumen que las filas de Stock involucradas ya
 * fueron bloqueadas con lockStockRows en la misma transacción.
 */

/** Suma `cantidad` a la asignación del origen dado de esa línea de venta (o la crea). */
export async function sumarAsignacion(
  tx: Prisma.TransactionClient,
  proformaDetalleId: string,
  origen: OrigenAsignacion,
  almacenId: string | null,
  cantidad: number,
): Promise<void> {
  const existente = await tx.proformaDetalleAsignacion.findFirst({ where: { proformaDetalleId, origen } });
  if (existente) {
    await tx.proformaDetalleAsignacion.update({ where: { id: existente.id }, data: { cantidad: { increment: cantidad } } });
  } else {
    await tx.proformaDetalleAsignacion.create({ data: { proformaDetalleId, almacenId, cantidad, origen } });
  }
}

/**
 * Reparte lo que hay disponible en tránsito (enTransito - reservadaTransito) entre la Procura pendiente
 * de ventas aprobadas para esa variante+almacén, la más antigua primero. Las Procura ya ligadas a una
 * línea de compra "Pedido de cliente" se saltean: esas ya tienen su propio pedido en camino.
 */
export async function reservarTransitoParaProcuras(
  tx: Prisma.TransactionClient,
  params: { varianteId: string; almacenId: string; excluirProformaId?: string },
): Promise<void> {
  const { varianteId, almacenId } = params;
  const where = { varianteId_almacenId: { varianteId, almacenId } };
  const stock = await tx.stock.findUniqueOrThrow({ where });
  let disponible = stock.cantidadEnTransito - stock.cantidadReservadaTransito;
  if (disponible <= 0) return;

  const procuras = await tx.proformaDetalleAsignacion.findMany({
    where: {
      origen: OrigenAsignacion.PROCURA,
      cantidad: { gt: 0 },
      compraDetalleId: null,
      proformaDetalle: {
        varianteId,
        proforma: {
          almacenId,
          estado: EstadoProforma.APROBADA,
          ...(params.excluirProformaId ? { id: { not: params.excluirProformaId } } : {}),
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const procura of procuras) {
    if (disponible <= 0) break;
    const tomar = Math.min(disponible, procura.cantidad);
    await tx.stock.update({ where, data: { cantidadReservadaTransito: { increment: tomar } } });
    await tx.proformaDetalleAsignacion.update({ where: { id: procura.id }, data: { cantidad: { decrement: tomar } } });
    await sumarAsignacion(tx, procura.proformaDetalleId, OrigenAsignacion.EN_TRANSITO, almacenId, tomar);
    disponible -= tomar;
  }
}

/**
 * Descuenta `quitar` unidades del tránsito de la variante+almacén (el envío se anuló o llegó). Si lo
 * que queda en tránsito ya no alcanza para cubrir las reservas en tránsito, el exceso se resuelve con
 * las ventas más antiguas primero: con `convertirAFisico` pasan a reservar stock físico (hasta lo
 * disponible tras la recepción) y el resto vuelve a Procura.
 */
export async function liquidarTransito(
  tx: Prisma.TransactionClient,
  params: { varianteId: string; almacenId: string; quitar: number; convertirAFisico: boolean },
): Promise<void> {
  const { varianteId, almacenId } = params;
  const where = { varianteId_almacenId: { varianteId, almacenId } };
  const stock = await tx.stock.findUniqueOrThrow({ where });

  const nuevoEnTransito = Math.max(0, stock.cantidadEnTransito - params.quitar);
  let exceso = Math.max(0, stock.cantidadReservadaTransito - nuevoEnTransito);
  let fisico = params.convertirAFisico ? Math.max(0, stock.cantidadFisica - stock.cantidadReservada) : 0;
  let aStockTotal = 0;
  let liberadoTotal = 0;

  if (exceso > 0) {
    const asignaciones = await tx.proformaDetalleAsignacion.findMany({
      where: {
        origen: OrigenAsignacion.EN_TRANSITO,
        cantidad: { gt: 0 },
        almacenId,
        proformaDetalle: { varianteId, proforma: { estado: EstadoProforma.APROBADA } },
      },
      orderBy: { createdAt: "asc" },
    });
    for (const a of asignaciones) {
      if (exceso <= 0) break;
      const take = Math.min(a.cantidad, exceso);
      const aStock = Math.min(take, fisico);
      const aProcura = take - aStock;

      if (take === a.cantidad) await tx.proformaDetalleAsignacion.delete({ where: { id: a.id } });
      else await tx.proformaDetalleAsignacion.update({ where: { id: a.id }, data: { cantidad: { decrement: take } } });

      if (aStock > 0) await sumarAsignacion(tx, a.proformaDetalleId, OrigenAsignacion.STOCK, almacenId, aStock);
      if (aProcura > 0) await sumarAsignacion(tx, a.proformaDetalleId, OrigenAsignacion.PROCURA, null, aProcura);

      fisico -= aStock;
      aStockTotal += aStock;
      liberadoTotal += take;
      exceso -= take;
    }
  }

  // Un único UPDATE: el CHECK de la fila se evalúa al final de la sentencia, no entre columnas.
  await tx.stock.update({
    where,
    data: {
      cantidadEnTransito: nuevoEnTransito,
      cantidadReservadaTransito: { decrement: liberadoTotal },
      ...(aStockTotal > 0 ? { cantidadReservada: { increment: aStockTotal } } : {}),
    },
  });
}
