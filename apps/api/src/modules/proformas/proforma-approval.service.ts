import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoProforma, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { ProformaHistorialService } from "./proforma-historial.service";
import { ProformasService } from "./proformas.service";
import { lockStockRows, stockKey } from "./stock-lock.util";

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

  async aprobar(id: string, usuarioId: string, almacenId?: string) {
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

          await this.aprobarVenta(tx, id, usuarioId, almacenId);
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
  private async aprobarVenta(tx: Prisma.TransactionClient, id: string, usuarioId: string, almacenId: string) {
    const proforma = await tx.proforma.findUniqueOrThrow({ where: { id }, include: { detalles: true } });

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

  private async liberarReservas(tx: Prisma.TransactionClient, proformaId: string) {
    const asignaciones = await tx.proformaDetalleAsignacion.findMany({
      where: { origen: OrigenAsignacion.STOCK, proformaDetalle: { proformaId } },
      include: { proformaDetalle: true },
    });
    if (asignaciones.length === 0) return;

    const pares = asignaciones.map((a) => ({ varianteId: a.proformaDetalle.varianteId, almacenId: a.almacenId! }));
    await lockStockRows(tx, pares);

    for (const asignacion of asignaciones) {
      await tx.stock.update({
        where: {
          varianteId_almacenId: { varianteId: asignacion.proformaDetalle.varianteId, almacenId: asignacion.almacenId! },
        },
        data: { cantidadReservada: { decrement: asignacion.cantidad } },
      });
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

          if (lock.tipo === TipoProforma.VENTA) {
            await this.liberarReservas(tx, id);
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
