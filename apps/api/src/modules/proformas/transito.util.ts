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
 * Pasa a stock físico lo que las ventas aprobadas tienen reservado "en tránsito", mientras haya stock físico libre
 * (disponible = físico - reservado) en ese almacén: la más antigua primero. La mercadería en camino queda libre para
 * otras ventas. Devuelve cuántas unidades pasaron.
 */
export async function pasarTransitoAStock(
  tx: Prisma.TransactionClient,
  params: { varianteId: string; almacenId: string; soloProformaId?: string },
): Promise<number> {
  const { varianteId, almacenId } = params;
  const where = { varianteId_almacenId: { varianteId, almacenId } };
  const stock = await tx.stock.findUniqueOrThrow({ where });
  let libre = stock.cantidadFisica - stock.cantidadReservada;
  if (libre <= 0) return 0;

  const asignaciones = await tx.proformaDetalleAsignacion.findMany({
    where: {
      origen: OrigenAsignacion.EN_TRANSITO,
      cantidad: { gt: 0 },
      almacenId,
      proformaDetalle: {
        varianteId,
        proforma: { estado: EstadoProforma.APROBADA, ...(params.soloProformaId ? { id: params.soloProformaId } : {}) },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let total = 0;
  for (const a of asignaciones) {
    if (libre <= 0) break;
    const tomar = Math.min(libre, a.cantidad);
    if (tomar === a.cantidad) await tx.proformaDetalleAsignacion.delete({ where: { id: a.id } });
    else await tx.proformaDetalleAsignacion.update({ where: { id: a.id }, data: { cantidad: { decrement: tomar } } });
    await sumarAsignacion(tx, a.proformaDetalleId, OrigenAsignacion.STOCK, almacenId, tomar);
    libre -= tomar;
    total += tomar;
  }
  if (total > 0) {
    // Un único UPDATE: el CHECK de la fila se evalúa al final de la sentencia.
    await tx.stock.update({ where, data: { cantidadReservada: { increment: total }, cantidadReservadaTransito: { decrement: total } } });
  }
  return total;
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
 * Lo que una línea de compra aporta al stock en tránsito: lo que va en envíos ya despachados (EN_TRANSITO) y todavía no
 * llegó, y que NO está ligado a una venta ni a una solicitud (esas unidades ya tienen dueño y absorben primero lo que
 * viaja). Lo recogido que sigue en un envío "Armando" o sin envío todavía no viaja y no cuenta.
 */
export function aporteEnTransito(params: { viaja: number; ligadas: number }): number {
  return Math.max(0, params.viaja - params.ligadas);
}

/**
 * Recalcula cuánto aporta al stock en tránsito una línea de compra y ajusta por la diferencia contra lo que ya
 * había aportado (ProformaDetalle.enTransitoContado), en el almacén destino de la compra. Se llama cuando cambia
 * lo que viaja (un envío sale, se anula, se cierra o recibe) o lo ligado a ventas/solicitudes. Con `convertirAFisico` (recepción de un envío) las
 * ventas con reserva en tránsito pasan a reservar el stock físico que acaba de llegar; si no, lo que ya no tiene
 * de dónde salir vuelve a Procura.
 */
export async function recalcularTransitoLinea(
  tx: Prisma.TransactionClient,
  compraDetalleId: string,
  opciones: { convertirAFisico?: boolean } = {},
): Promise<void> {
  const linea = await tx.proformaDetalle.findUnique({
    where: { id: compraDetalleId },
    select: {
      varianteId: true,
      enTransitoContado: true,
      enTransitoAlmacenId: true,
      proforma: { select: { estado: true, almacenId: true } },
      envioItems: { where: { envio: { estado: EstadoEnvio.EN_TRANSITO } }, select: { cantidad: true, cantidadRecibida: true } },
      asignacionesCubiertas: { select: { cantidad: true } },
      solicitudesCubiertas: { select: { cantidad: true, cantidadRecibida: true } },
    },
  });
  if (!linea) return;

  const almacenId = linea.proforma.almacenId;
  const activa = linea.proforma.estado === EstadoProforma.APROBADA && Boolean(almacenId);
  const viaja = linea.envioItems.reduce((n, i) => n + Math.max(0, i.cantidad - i.cantidadRecibida), 0);
  const ligadas =
    linea.asignacionesCubiertas.reduce((n, a) => n + a.cantidad, 0) +
    linea.solicitudesCubiertas.reduce((n, s) => n + Math.max(0, s.cantidad - s.cantidadRecibida), 0);
  const deseado = activa ? aporteEnTransito({ viaja, ligadas }) : 0;

  const pares = new Map<string, { varianteId: string; almacenId: string }>();
  if (linea.enTransitoAlmacenId) pares.set(linea.enTransitoAlmacenId, { varianteId: linea.varianteId, almacenId: linea.enTransitoAlmacenId });
  if (almacenId) pares.set(almacenId, { varianteId: linea.varianteId, almacenId });
  if (linea.enTransitoContado === 0 && deseado === 0) return;
  await lockStockRows(tx, Array.from(pares.values()));

  let contado = linea.enTransitoContado;
  // Cambió el almacén destino: lo contado en el anterior se retira y se vuelve a contar en el nuevo.
  if (contado > 0 && linea.enTransitoAlmacenId && linea.enTransitoAlmacenId !== almacenId) {
    await liquidarTransito(tx, { varianteId: linea.varianteId, almacenId: linea.enTransitoAlmacenId, quitar: contado, convertirAFisico: false });
    contado = 0;
  }
  const delta = deseado - contado;
  if (delta > 0 && almacenId) {
    await tx.stock.update({
      where: { varianteId_almacenId: { varianteId: linea.varianteId, almacenId } },
      data: { cantidadEnTransito: { increment: delta } },
    });
  } else if (delta < 0 && linea.enTransitoAlmacenId) {
    await liquidarTransito(tx, {
      varianteId: linea.varianteId,
      almacenId: linea.enTransitoAlmacenId,
      quitar: -delta,
      convertirAFisico: opciones.convertirAFisico ?? false,
    });
  }
  await tx.proformaDetalle.update({
    where: { id: compraDetalleId },
    data: { enTransitoContado: deseado, enTransitoAlmacenId: deseado > 0 ? almacenId : null },
  });
}
