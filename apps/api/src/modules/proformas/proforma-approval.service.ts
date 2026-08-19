import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoProforma, MonedaCartera, NaturalezaMovimiento, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { ProformaHistorialService } from "./proforma-historial.service";
import { ProformasService } from "./proformas.service";
import { lockStockRows, stockKey } from "./stock-lock.util";
import { resolverProcuraPendiente } from "./procura.util";
import { lockCarteras } from "../contabilidad/cartera-lock.util";

/** Mismo cálculo que ProformaTotales.tsx (frontend) — nada se persiste server-side hasta ahora, así
 * que se replica acá para saber cuánto ingresar en la cartera al aprobar. Redondeado a 2 decimales
 * (Decimal(14,2) de MovimientoCartera.monto). */
function calcularMontoAdelanto(detalles: { subtotal: Prisma.Decimal }[], descuentoGeneral: Prisma.Decimal, adelantoPorcentaje: Prisma.Decimal | null): number {
  const subtotal = detalles.reduce((sum, d) => sum + Number(d.subtotal), 0);
  const total = subtotal - Number(descuentoGeneral);
  const porcentaje = Number(adelantoPorcentaje ?? 0);
  return Math.round(total * (porcentaje / 100) * 100) / 100;
}

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

  async aprobar(id: string, usuarioId: string, almacenId?: string, carteraId?: string) {
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
            await tx.proforma.update({ where: { id }, data: { estado: EstadoProforma.APROBADA } });
            await this.historial.registrar(tx, id, EstadoProforma.APROBADA, usuarioId);
            return;
          }

          if (!almacenId) throw new BadRequestException("almacenId es obligatorio para aprobar una proforma de venta.");
          const almacen = await tx.almacen.findUnique({ where: { id: almacenId } });
          if (!almacen) throw new BadRequestException(`almacenId inválido: ${almacenId}`);

          await this.aprobarVenta(tx, id, usuarioId, almacenId, carteraId);
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
  private async aprobarVenta(tx: Prisma.TransactionClient, id: string, usuarioId: string, almacenId: string, carteraId?: string) {
    const proforma = await tx.proforma.findUniqueOrThrow({ where: { id }, include: { detalles: true, cliente: true } });

    const montoAdelanto = calcularMontoAdelanto(proforma.detalles, proforma.descuentoGeneral, proforma.adelantoPorcentaje);
    if (montoAdelanto > 0) {
      if (!carteraId) throw new BadRequestException("carteraId es obligatorio: la proforma tiene un adelanto a registrar en una cartera en Bs.");
      const cartera = await tx.cartera.findUnique({ where: { id: carteraId } });
      if (!cartera || !cartera.activo) throw new BadRequestException(`carteraId inválido o inactivo: ${carteraId}`);
      if (cartera.moneda !== MonedaCartera.BS) throw new BadRequestException("La cartera del adelanto debe ser en Bs.");

      await lockCarteras(tx, [carteraId]);
      const porcentaje = Number(proforma.adelantoPorcentaje ?? 0);
      await tx.movimientoCartera.create({
        data: {
          carteraId,
          fecha: new Date(),
          detalle: `CL: ${proforma.cliente?.nombre ?? "—"} - PR: ${id} - ADL: ${porcentaje}%`,
          naturaleza: NaturalezaMovimiento.INGRESO,
          monto: montoAdelanto,
          proformaId: id,
          creadoPorId: usuarioId,
        },
      });
      await tx.cartera.update({ where: { id: carteraId }, data: { saldoActual: { increment: montoAdelanto } } });
    }

    const pares = proforma.detalles.map((d) => ({ varianteId: d.varianteId, almacenId }));
    const stockPorPar = await lockStockRows(tx, pares);

    const faltantes: string[] = [];
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

      const restante = detalle.cantidad - tomar;
      if (restante > 0) {
        await tx.proformaDetalleAsignacion.create({
          data: { proformaDetalleId: detalle.id, almacenId: null, cantidad: restante, origen: OrigenAsignacion.PROCURA },
        });
        faltantes.push(`${restante} unidad(es) de la variante ${detalle.varianteId}`);
      }
    }

    await tx.proforma.update({ where: { id }, data: { estado: EstadoProforma.APROBADA, almacenId } });
    await this.historial.registrar(
      tx,
      id,
      EstadoProforma.APROBADA,
      usuarioId,
      faltantes.length > 0 ? `Stock insuficiente, a procura: ${faltantes.join(", ")}.` : undefined,
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
    const stockAsignaciones = await tx.proformaDetalleAsignacion.findMany({
      where: { origen: OrigenAsignacion.STOCK, proformaDetalle: { proformaId } },
      include: { proformaDetalle: true },
    });

    if (stockAsignaciones.length > 0) {
      const pares = stockAsignaciones.map((a) => ({ varianteId: a.proformaDetalle.varianteId, almacenId: a.almacenId! }));
      await lockStockRows(tx, pares);

      for (const asignacion of stockAsignaciones) {
        const varianteId = asignacion.proformaDetalle.varianteId;
        const almacenId = asignacion.almacenId!;

        await tx.stock.update({
          where: { varianteId_almacenId: { varianteId, almacenId } },
          data: { cantidadReservada: { decrement: asignacion.cantidad } },
        });

        await resolverProcuraPendiente(tx, { varianteId, almacenId, disponible: asignacion.cantidad, excluirProformaId: proformaId });
      }
    }

    await tx.proformaDetalleAsignacion.updateMany({
      where: { origen: OrigenAsignacion.PROCURA, cantidad: { gt: 0 }, proformaDetalle: { proformaId } },
      data: { cantidad: 0 },
    });
  }

  /** Si esta venta tuvo un adelanto registrado al aprobarla (ver aprobarVenta), revertirlo con un
   * gasto por el mismo monto en la misma cartera — mismo formato de detalle que el ingreso original,
   * agregando al final la marca ANULADA y el motivo escrito al anular (si lo hay). */
  private async revertirAdelanto(tx: Prisma.TransactionClient, proformaId: string, usuarioId: string, nota?: string) {
    const ingreso = await tx.movimientoCartera.findFirst({
      where: { proformaId, naturaleza: NaturalezaMovimiento.INGRESO },
      orderBy: { createdAt: "asc" },
    });
    if (!ingreso) return;

    await lockCarteras(tx, [ingreso.carteraId]);
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

          if (lock.tipo === TipoProforma.VENTA) {
            await this.liberarReservas(tx, id);
            await this.revertirAdelanto(tx, id, usuarioId, nota);
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
