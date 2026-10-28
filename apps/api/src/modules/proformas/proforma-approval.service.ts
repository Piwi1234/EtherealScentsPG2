import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoCuentaPorCobrar, EstadoEnvio, EstadoProforma, MonedaCartera, NaturalezaMovimiento, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { ProformaHistorialService } from "./proforma-historial.service";
import { ProformasService } from "./proformas.service";
import { lockStockRows, stockKey } from "./stock-lock.util";
import { resolverProcuraPendiente } from "./procura.util";
import { pasarTransitoAStock, recalcularTransitoLinea, reservarTransitoParaProcuras } from "./transito.util";
import { calcularTotalesVenta } from "./proforma-totales.util";
import { lockCarteras } from "../contabilidad/cartera-lock.util";

/**
 * Motor de aprobación: bloqueo transaccional + reserva de stock contra el único almacén elegido para
 * la proforma (VENTA), transición simple (COMPRA); y liberación de reservas al anular una venta ya
 * aprobada.
 *
 * Estrategia de locking: SELECT ... FOR UPDATE explícito vía $queryRaw dentro de
 * prisma.$transaction, no Serializable+reintento — la aprobación es un punto real de contención
 * (proformas concurrentes compitiendo por la misma variante+almacén) y los bloqueos pesimistas de
 * alcance mínimo son más simples de razonar que un loop de reintento optimista. READ COMMITTED (el
 * default de Postgres) alcanza: los FOR UPDATE/upsert explícitos ya dan la serialización correcta
 * para este patrón de acceso.
 */
@Injectable()
export class ProformaApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historial: ProformaHistorialService,
    private readonly proformas: ProformasService,
  ) {}

  /**
   * Cambia el almacén destino de una compra aprobada (donde cuenta su stock en tránsito). No se puede si alguno
   * de sus productos ya está en un envío vigente: el envío define a dónde llega.
   */
  async cambiarAlmacenCompra(id: string, almacenId: string) {
    const compra = await this.prisma.proforma.findUnique({ where: { id }, select: { tipo: true, estado: true } });
    if (!compra) throw new NotFoundException("Proforma no encontrada.");
    if (compra.tipo !== TipoProforma.COMPRA || compra.estado !== EstadoProforma.APROBADA) {
      throw new ConflictException("Solo se cambia el almacén destino de una compra aprobada.");
    }
    if (!(await this.prisma.almacen.findFirst({ where: { id: almacenId, activo: true }, select: { id: true } }))) {
      throw new BadRequestException("almacenId inválido o inactivo.");
    }
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          await tx.$queryRaw`SELECT "id" FROM "proformas" WHERE "id" = ${id}::uuid FOR UPDATE`;
          if ((await tx.envioItem.count({ where: { compraDetalle: { proformaId: id }, envio: { estado: { not: EstadoEnvio.ANULADO } } } })) > 0) {
            throw new ConflictException("Hay productos de esta compra en un envío: el envío define el almacén. Sacalos del envío primero.");
          }
          await tx.proforma.update({ where: { id }, data: { almacenId } });
          const lineas = await tx.proformaDetalle.findMany({ where: { proformaId: id }, select: { id: true } });
          for (const l of lineas) await recalcularTransitoLinea(tx, l.id);
        },
        { timeout: 20000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }
    return this.proformas.findOne(id);
  }

  /**
   * Toma a mano el stock libre para ventas aprobadas, la más antigua primero. Con `proformaId` solo para esa nota; sin
   * él, "reservar todo lo posible". Hace tres cosas por producto y almacén:
   *  1. El faltante (Procura) sin compra ligada toma stock físico libre.
   *  2. Lo reservado "en tránsito" pasa a stock físico si ya hay disponible para entrega inmediata (por ejemplo, tras
   *     anular otra nota): la mercadería en camino queda libre para otras ventas.
   *  3. Lo que aún falta toma stock en tránsito libre.
   * Los faltantes ligados a una compra no se tocan (se cubren al recibirla).
   */
  async reservarFaltantes(usuarioId: string, proformaId?: string) {
    const ventaFiltro: Prisma.ProformaWhereInput = { tipo: TipoProforma.VENTA, estado: EstadoProforma.APROBADA, ...(proformaId ? { id: proformaId } : {}) };
    const where: Prisma.ProformaDetalleAsignacionWhereInput = {
      cantidad: { gt: 0 },
      OR: [{ origen: OrigenAsignacion.PROCURA, compraDetalleId: null }, { origen: OrigenAsignacion.EN_TRANSITO }],
      proformaDetalle: { proforma: ventaFiltro },
    };
    const pendientes = await this.prisma.proformaDetalleAsignacion.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: { proformaDetalle: { select: { varianteId: true, proforma: { select: { almacenId: true } } } } },
    });
    if (proformaId && pendientes.length === 0) {
      const p = await this.prisma.proforma.findUnique({ where: { id: proformaId }, select: { tipo: true, estado: true } });
      if (!p) throw new NotFoundException("Proforma no encontrada.");
      if (p.tipo !== TipoProforma.VENTA || p.estado !== EstadoProforma.APROBADA) throw new ConflictException("Solo se reserva stock para ventas aprobadas.");
    }
    const pares = new Map<string, { varianteId: string; almacenId: string }>();
    for (const a of pendientes) {
      const almacenId = a.proformaDetalle.proforma.almacenId;
      if (almacenId) pares.set(stockKey(a.proformaDetalle.varianteId, almacenId), { varianteId: a.proformaDetalle.varianteId, almacenId });
    }

    // Foto del stock físico reservado por línea antes y después: la diferencia es lo que se tomó.
    const fotoStock = async () => {
      const filas = await this.prisma.proformaDetalleAsignacion.findMany({
        where: { origen: OrigenAsignacion.STOCK, cantidad: { gt: 0 }, proformaDetalle: { proforma: ventaFiltro } },
        select: { cantidad: true, proformaDetalleId: true, proformaDetalle: { select: { proformaId: true, variante: { select: { product: { select: { name: true } } } } } } },
      });
      const porLinea = new Map<string, { cantidad: number; proformaId: string; producto: string }>();
      for (const f of filas) {
        const e = porLinea.get(f.proformaDetalleId) ?? { cantidad: 0, proformaId: f.proformaDetalle.proformaId, producto: f.proformaDetalle.variante.product.name };
        e.cantidad += f.cantidad;
        porLinea.set(f.proformaDetalleId, e);
      }
      return porLinea;
    };
    const sumaProcura = async () =>
      (await this.prisma.proformaDetalleAsignacion.aggregate({
        where: { origen: OrigenAsignacion.PROCURA, cantidad: { gt: 0 }, compraDetalleId: null, proformaDetalle: { proforma: ventaFiltro } },
        _sum: { cantidad: true },
      }))._sum.cantidad ?? 0;
    const antes = await fotoStock();
    const procuraAntes = await sumaProcura();
    let pasadasDeTransito = 0;

    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCK_TIMEOUT = '5s'`;
          await lockStockRows(tx, Array.from(pares.values()));
          for (const par of pares.values()) {
            const stock = await tx.stock.findUniqueOrThrow({ where: { varianteId_almacenId: par } });
            await resolverProcuraPendiente(tx, {
              ...par,
              disponible: stock.cantidadFisica - stock.cantidadReservada,
              soloLibres: true,
              soloProformaId: proformaId,
            });
            pasadasDeTransito += await pasarTransitoAStock(tx, { ...par, soloProformaId: proformaId });
            await reservarTransitoParaProcuras(tx, { ...par, soloProformaId: proformaId });
          }
        },
        { timeout: 20000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }

    // Rastro en el historial de cada venta que recibió stock físico.
    const despues = await fotoStock();
    const porVenta = new Map<string, string[]>();
    for (const [lineaId, d] of despues) {
      const tomadas = d.cantidad - (antes.get(lineaId)?.cantidad ?? 0);
      if (tomadas <= 0) continue;
      const lista = porVenta.get(d.proformaId) ?? [];
      lista.push(`${tomadas} unidad(es) de ${d.producto}`);
      porVenta.set(d.proformaId, lista);
    }
    for (const [id, lista] of porVenta) {
      await this.prisma.$transaction((tx) => this.historial.registrar(tx, id, EstadoProforma.APROBADA, usuarioId, `Stock reservado: ${lista.join(", ")}.`));
    }
    const cubiertasDeFaltante = Math.max(0, procuraAntes - (await sumaProcura()));
    return { unidadesReservadas: cubiertasDeFaltante + pasadasDeTransito, pasadasDeTransito };
  }

  async aprobar(id: string, usuarioId: string, almacenId?: string, carteraId?: string, montoAdelantoCobrado?: number) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;

          const rows = await tx.$queryRaw<{ estado: EstadoProforma; tipo: TipoProforma }[]>`
            SELECT "estado", "tipo" FROM "proformas" WHERE "id" = ${id}::uuid FOR UPDATE
          `;
          const lock = rows[0];
          if (!lock) throw new NotFoundException("Proforma no encontrada.");
          if (lock.estado !== EstadoProforma.BORRADOR) {
            throw new ConflictException(`No se puede aprobar: la proforma está en estado ${lock.estado}.`);
          }

          const detalleCount = await tx.proformaDetalle.count({ where: { proformaId: id } });
          if (detalleCount === 0) {
            throw new BadRequestException("La proforma no tiene líneas.");
          }

          if (lock.tipo === TipoProforma.COMPRA) {
            if (almacenId) throw new BadRequestException("almacenId no aplica a una proforma de compra.");
            // Una nota de compra es de un proveedor (compras viejas: cada línea con el suyo).
            const compra = await tx.proforma.findUniqueOrThrow({ where: { id }, include: { detalles: { select: { proveedorId: true } } } });
            if (!compra.proveedorId && compra.detalles.some((d) => !d.proveedorId)) {
              throw new BadRequestException("Elegí el proveedor de la compra antes de aprobarla.");
            }
            await tx.proforma.update({ where: { id }, data: { estado: EstadoProforma.APROBADA } });
            await this.historial.registrar(tx, id, EstadoProforma.APROBADA, usuarioId);
            return;
          }

          if (!almacenId) throw new BadRequestException("almacenId es obligatorio para aprobar una proforma de venta.");
          const almacen = await tx.almacen.findUnique({ where: { id: almacenId } });
          if (!almacen) throw new BadRequestException(`almacenId inválido: ${almacenId}`);

          await this.aprobarVenta(tx, id, usuarioId, almacenId, carteraId, montoAdelantoCobrado);
        },
        { timeout: 15000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }
    return this.proformas.findOne(id);
  }

  /**
   * Reserva stock contra el único almacén de la proforma: STOCK por lo que alcanza, PROCURA por el
   * resto. Nunca bloquea la aprobación por falta de stock — la Procura se resuelve más adelante, sola,
   * cuando se completa una compra que trae stock para esa variante+almacén (ver
   * proforma-completion.service.ts).
   */
  private async aprobarVenta(tx: Prisma.TransactionClient, id: string, usuarioId: string, almacenId: string, carteraId?: string, montoAdelantoCobrado?: number) {
    const proforma = await tx.proforma.findUniqueOrThrow({ where: { id }, include: { detalles: { include: { variante: { include: { product: { select: { name: true } } } } } }, cliente: true } });

    if (!proforma.clienteId) throw new BadRequestException("Elegí un cliente antes de aprobar la proforma de venta.");

    // El adelanto se puede cobrar ya al aprobar (si llega carteraId) o después, desde los pagos de la
    // proforma — mientras esté APROBADA el cliente puede ir pagando (ver proforma-pagos.service.ts).
    const { total, montoAdelanto } = calcularTotalesVenta(proforma);
    let adelantoCobrado = 0;
    if (montoAdelanto > 0 && carteraId) {
      // El cliente a veces paga menos o más que el porcentaje pactado: se cobra lo que realmente entregó.
      const montoCobrar = montoAdelantoCobrado !== undefined ? Math.round(montoAdelantoCobrado * 100) / 100 : montoAdelanto;
      if (montoCobrar > Math.round(total * 100) / 100) throw new BadRequestException("El adelanto no puede superar el total de la venta.");
      const cartera = await tx.cartera.findUnique({ where: { id: carteraId } });
      if (!cartera || !cartera.activo) throw new BadRequestException(`carteraId inválido o inactivo: ${carteraId}`);
      if (cartera.moneda !== MonedaCartera.BS) throw new BadRequestException("La cartera del adelanto debe ser en Bs.");

      await lockCarteras(tx, [carteraId]);
      const porcentaje = Number(proforma.adelantoPorcentaje ?? 0);
      await tx.movimientoCartera.create({
        data: {
          carteraId,
          fecha: new Date(),
          detalle: `CL: ${proforma.cliente?.nombre ?? "—"} - PR: ${proforma.codigo} - ADL: ${porcentaje}%`,
          naturaleza: NaturalezaMovimiento.INGRESO,
          monto: montoCobrar,
          proformaId: id,
          creadoPorId: usuarioId,
        },
      });
      await tx.cartera.update({ where: { id: carteraId }, data: { saldoActual: { increment: montoCobrar } } });
      adelantoCobrado = montoCobrar;
    }

    // La cuenta por cobrar nace con la venta aprobada (no al completarla): así se le da seguimiento
    // mientras está aprobada y también después de completada.
    const adeudado = Math.round((total - adelantoCobrado) * 100) / 100;
    await tx.cuentaPorCobrar.create({
      data: {
        proformaId: id,
        montoTotal: total,
        montoAdeudado: Math.max(0, adeudado),
        estado: adeudado <= 0 ? EstadoCuentaPorCobrar.COMPLETADO : EstadoCuentaPorCobrar.PENDIENTE,
      },
    });

    const pares = proforma.detalles.map((d) => ({ varianteId: d.varianteId, almacenId }));
    const stockPorPar = await lockStockRows(tx, pares);

    const faltantes: string[] = [];
    const enTransito: string[] = [];
    for (const detalle of proforma.detalles) {
      const stock = stockPorPar.get(stockKey(detalle.varianteId, almacenId))!;
      const disponibleNeto = stock.cantidadFisica - stock.cantidadReservada;
      const tomar = Math.min(disponibleNeto, detalle.cantidad);

      if (tomar > 0) {
        await tx.stock.update({
          where: { varianteId_almacenId: { varianteId: detalle.varianteId, almacenId } },
          data: { cantidadReservada: { increment: tomar } },
        });
        stock.cantidadReservada += tomar;
        await tx.proformaDetalleAsignacion.create({
          data: { proformaDetalleId: detalle.id, almacenId, cantidad: tomar, origen: OrigenAsignacion.STOCK },
        });
      }

      // Lo que no alcanza en físico se reserva por adelantado contra lo que viaja en envíos en tránsito.
      const disponibleTransito = stock.cantidadEnTransito - stock.cantidadReservadaTransito;
      const tomarTransito = Math.min(Math.max(0, disponibleTransito), detalle.cantidad - tomar);
      if (tomarTransito > 0) {
        await tx.stock.update({
          where: { varianteId_almacenId: { varianteId: detalle.varianteId, almacenId } },
          data: { cantidadReservadaTransito: { increment: tomarTransito } },
        });
        stock.cantidadReservadaTransito += tomarTransito;
        await tx.proformaDetalleAsignacion.create({
          data: { proformaDetalleId: detalle.id, almacenId, cantidad: tomarTransito, origen: OrigenAsignacion.EN_TRANSITO },
        });
        enTransito.push(`${tomarTransito} unidad(es) de ${detalle.variante.product.name}`);
      }

      const restante = detalle.cantidad - tomar - tomarTransito;
      if (restante > 0) {
        await tx.proformaDetalleAsignacion.create({
          data: { proformaDetalleId: detalle.id, almacenId: null, cantidad: restante, origen: OrigenAsignacion.PROCURA },
        });
        faltantes.push(`${restante} unidad(es) de ${detalle.variante.product.name}`);
      }
    }

    await tx.proforma.update({ where: { id }, data: { estado: EstadoProforma.APROBADA, almacenId } });
    await this.historial.registrar(
      tx,
      id,
      EstadoProforma.APROBADA,
      usuarioId,
      [
        enTransito.length > 0 ? `Reservado en tránsito: ${enTransito.join(", ")}.` : "",
        faltantes.length > 0 ? `Stock insuficiente, a procura: ${faltantes.join(", ")}.` : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined,
    );
  }

  /**
   * Libera la reserva (cantidadReservada) de cada línea con stock reservado al anular una venta
   * aprobada — y de paso reparte lo recién liberado entre la Procura pendiente de OTRAS ventas ya
   * aprobadas para esa misma variante+almacén, por orden de aprobación (más antigua primero), igual
   * mecanismo que al completar una compra (ver procura.util.ts). Además cancela la Procura PROPIA de
   * esta proforma (si le quedaba algo pendiente): el pedido se cancela, ya no hace falta seguir
   * pidiéndole al proveedor lo que le faltaba — no libera stock real, solo apaga la marca de "todavía
   * se necesita" para que deje de aparecer en Seguimiento.
   */
  private async liberarReservas(tx: Prisma.TransactionClient, proformaId: string) {
    const asignaciones = await tx.proformaDetalleAsignacion.findMany({
      where: { origen: { in: [OrigenAsignacion.STOCK, OrigenAsignacion.EN_TRANSITO] }, proformaDetalle: { proformaId } },
      include: { proformaDetalle: true },
    });

    if (asignaciones.length > 0) {
      const pares = asignaciones.map((a) => ({ varianteId: a.proformaDetalle.varianteId, almacenId: a.almacenId! }));
      await lockStockRows(tx, pares);

      for (const asignacion of asignaciones) {
        const varianteId = asignacion.proformaDetalle.varianteId;
        const almacenId = asignacion.almacenId!;
        const where = { varianteId_almacenId: { varianteId, almacenId } };

        if (asignacion.origen === OrigenAsignacion.EN_TRANSITO) {
          await tx.stock.update({ where, data: { cantidadReservadaTransito: { decrement: asignacion.cantidad } } });
        } else {
          await tx.stock.update({ where, data: { cantidadReservada: { decrement: asignacion.cantidad } } });
        }
      }
    }

    await tx.proformaDetalleAsignacion.updateMany({
      where: { origen: { in: [OrigenAsignacion.PROCURA, OrigenAsignacion.EN_TRANSITO] }, cantidad: { gt: 0 }, proformaDetalle: { proformaId } },
      data: { cantidad: 0 },
    });
  }

  /** Revierte TODO lo cobrado de esta venta (adelanto y pagos hechos mientras estaba aprobada): un
   * gasto por el mismo monto en la misma cartera por cada ingreso — mismo formato de detalle que el
   * ingreso original, agregando al final la marca ANULADA y el motivo escrito al anular (si lo hay).
   * Solo se llama al anular desde APROBADA, y una venta anulada no admite más pagos, así que cada
   * ingreso se revierte una sola vez. */
  private async revertirPagos(tx: Prisma.TransactionClient, proformaId: string, usuarioId: string, nota?: string) {
    const ingresos = await tx.movimientoCartera.findMany({
      where: { proformaId, naturaleza: NaturalezaMovimiento.INGRESO },
      orderBy: { createdAt: "asc" },
    });
    if (ingresos.length === 0) return;

    await lockCarteras(tx, Array.from(new Set(ingresos.map((i) => i.carteraId))));
    for (const ingreso of ingresos) {
      await tx.movimientoCartera.create({
        data: {
          carteraId: ingreso.carteraId,
          fecha: new Date(),
          detalle: `${ingreso.detalle} - ANULADA${nota ? ` - MOTIVO: ${nota}` : ""}`,
          naturaleza: NaturalezaMovimiento.GASTO,
          monto: ingreso.monto,
          proformaId,
          creadoPorId: usuarioId,
        },
      });
      await tx.cartera.update({ where: { id: ingreso.carteraId }, data: { saldoActual: { decrement: ingreso.monto } } });
    }
  }

  /** APROBADA → ANULADA únicamente (BORRADOR se elimina en vez de anularse; COMPLETADA es terminal). */
  async anular(id: string, usuarioId: string, nota?: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;

          const rows = await tx.$queryRaw<{ estado: EstadoProforma; tipo: TipoProforma }[]>`
            SELECT "estado", "tipo" FROM "proformas" WHERE "id" = ${id}::uuid FOR UPDATE
          `;
          const lock = rows[0];
          if (!lock) throw new NotFoundException("Proforma no encontrada.");
          if (lock.estado !== EstadoProforma.APROBADA) {
            throw new ConflictException(`No se puede anular: la proforma está en estado ${lock.estado} (solo se puede anular desde APROBADA).`);
          }

          if (lock.tipo === TipoProforma.COMPRA) {
            if ((await tx.envioItem.count({ where: { compraDetalle: { proformaId: id }, envio: { estado: { not: EstadoEnvio.ANULADO } } } })) > 0) {
              throw new ConflictException("No se puede anular: la compra tiene productos en un envío. Sacalos del envío primero.");
            }
            if ((await tx.recojo.count({ where: { compraId: id } })) > 0) {
              throw new ConflictException("No se puede anular: la compra tiene recojos registrados. Deshacelos primero.");
            }
            // Una compra anulada ya no cubre nada: los faltantes de ventas y las líneas de solicitudes de
            // stock que tenía ligados quedan libres otra vez.
            await tx.proformaDetalleAsignacion.updateMany({ where: { compraDetalle: { proformaId: id } }, data: { compraDetalleId: null } });
            await tx.solicitudStockLinea.updateMany({ where: { compraDetalle: { proformaId: id } }, data: { compraDetalleId: null } });
          }

          if (lock.tipo === TipoProforma.VENTA) {
            await this.liberarReservas(tx, id);
            await this.revertirPagos(tx, id, usuarioId, nota);
            await tx.cuentaPorCobrar.deleteMany({ where: { proformaId: id } });
          }

          await tx.proforma.update({ where: { id }, data: { estado: EstadoProforma.ANULADA } });
          await this.historial.registrar(tx, id, EstadoProforma.ANULADA, usuarioId, nota);
        },
        { timeout: 15000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }
    return this.proformas.findOne(id);
  }
}
