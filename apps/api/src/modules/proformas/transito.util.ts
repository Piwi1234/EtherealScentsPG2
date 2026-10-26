import { EstadoEnvio, EstadoProforma, OrigenAsignacion, Prisma } from "@app/database";
import { lockStockRows } from "./stock-lock.util";

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
  // Una Procura se suma a la fila libre, no a una ya ligada a una compra (su cantidad ligada no debe crecer sola).
  const existente = await tx.proformaDetalleAsignacion.findFirst({
    where: { proformaDetalleId, origen, ...(origen === OrigenAsignacion.PROCURA ? { compraDetalleId: null } : {}) },
  });
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
  params: { varianteId: string; almacenId: string; excluirProformaId?: string; soloProformaId?: string },
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
          ...(params.soloProformaId ? { id: params.soloProformaId } : {}),
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

/**
 * Reparte lo que cada ítem de envío (de la más antigua a la más nueva) aporta al stock en tránsito: las unidades
 * de la línea ligadas a notas de venta ya tienen dueño y absorben primero lo que viaja; lo demás es stock libre.
 */
export function aportesPorItem(pendientes: number[], ligadas: number): number[] {
  let absorbe = ligadas;
  return pendientes.map((pend) => {
    const libre = Math.max(0, pend - absorbe);
    absorbe = Math.max(0, absorbe - pend);
    return libre;
  });
}

/**
 * Recalcula cuánto aporta al stock en tránsito cada ítem de envío ya despachado (EN_TRANSITO) de una línea de
 * compra, y ajusta por la diferencia contra lo que ya había aportado. Se llama cuando cambia lo que viaja
 * (se despacha un envío) o lo que la línea tiene ligado a notas de venta. Ligar más resta del tránsito
 * disponible (si ya había ventas reservadas encima y no alcanza, vuelven a Procura); soltar lo suma y lo
 * ofrece a las ventas con faltante.
 */
export async function recalcularTransitoLinea(tx: Prisma.TransactionClient, compraDetalleId: string): Promise<void> {
  const linea = await tx.proformaDetalle.findUnique({
    where: { id: compraDetalleId },
    select: {
      varianteId: true,
      asignacionesCubiertas: { select: { cantidad: true } },
      envioItems: {
        where: { envio: { estado: EstadoEnvio.EN_TRANSITO } },
        orderBy: { createdAt: "asc" },
        select: { id: true, cantidad: true, cantidadRecibida: true, enTransitoContado: true, envio: { select: { almacenDestinoId: true } } },
      },
    },
  });
  if (!linea || linea.envioItems.length === 0) return;

  const ligadas = linea.asignacionesCubiertas.reduce((n, a) => n + a.cantidad, 0);
  const deseados = aportesPorItem(
    linea.envioItems.map((it) => it.cantidad - it.cantidadRecibida),
    ligadas,
  );
  await lockStockRows(
    tx,
    Array.from(new Set(linea.envioItems.map((it) => it.envio.almacenDestinoId))).map((almacenId) => ({ varianteId: linea.varianteId, almacenId })),
  );
  for (const [i, it] of linea.envioItems.entries()) {
    const delta = deseados[i] - it.enTransitoContado;
    if (delta === 0) continue;
    const almacenId = it.envio.almacenDestinoId;
    if (delta > 0) {
      await tx.stock.update({
        where: { varianteId_almacenId: { varianteId: linea.varianteId, almacenId } },
        data: { cantidadEnTransito: { increment: delta } },
      });
    } else {
      await liquidarTransito(tx, { varianteId: linea.varianteId, almacenId, quitar: -delta, convertirAFisico: false });
    }
    await tx.envioItem.update({ where: { id: it.id }, data: { enTransitoContado: deseados[i] } });
  }
}
