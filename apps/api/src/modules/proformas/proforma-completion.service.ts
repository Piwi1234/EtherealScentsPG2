import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { EstadoProforma, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { ProformaHistorialService } from "./proforma-historial.service";
import { ProformasService } from "./proformas.service";
import { lockStockRows } from "./stock-lock.util";

type LoteRow = { id: string; cantidad_disponible: number };

/**
 * Completado: sincronización de costeo (COMPRA — crea LoteCompra + stock, nunca toca el catálogo) y
 * consumo FIFO (VENTA — descuenta Stock reservado/físico y consume LoteCompra en orden de fecha,
 * registrando de qué lote(s) salió cada unidad vendida).
 */
@Injectable()
export class ProformaCompletionService {
  private readonly logger = new Logger(ProformaCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly historial: ProformaHistorialService,
    private readonly proformas: ProformasService,
  ) {}

  async completar(id: string, usuarioId: string) {
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
            throw new ConflictException(`No se puede completar: la proforma está en estado ${lock.estado}.`);
          }

          if (lock.tipo === TipoProforma.COMPRA) {
            await this.completarCompra(tx, id);
          } else {
            await this.completarVenta(tx, id);
          }

          await tx.proforma.update({ where: { id }, data: { estado: EstadoProforma.COMPLETADA } });
          await this.historial.registrar(tx, id, EstadoProforma.COMPLETADA, usuarioId);
          await this.onProformaCompletada(id, tx);
        },
        { timeout: 15000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }
    return this.proformas.findOne(id);
  }

  /**
   * Crea un LoteCompra por línea con el costo real de esa compra e incrementa el stock físico del
   * almacén de recepción. El catálogo (Product/ProductVariant) NUNCA se toca acá — decisión explícita
   * del usuario: la estructura de costos heredados de categoría se mantiene tal cual, sin overrides
   * por variante ni por compra.
   */
  private async completarCompra(tx: Prisma.TransactionClient, proformaId: string) {
    const proforma = await tx.proforma.findUniqueOrThrow({
      where: { id: proformaId },
      include: { detalles: true },
    });
    if (!proforma.almacenRecepcionId) {
      throw new ConflictException("Falta almacenRecepcionId: no se puede recibir la mercadería en ningún almacén.");
    }
    if (proforma.detalles.length === 0) {
      throw new ConflictException("La proforma no tiene líneas.");
    }

    const pares = proforma.detalles.map((d) => ({ varianteId: d.varianteId, almacenId: proforma.almacenRecepcionId! }));
    await lockStockRows(tx, pares);

    for (const detalle of proforma.detalles) {
      const costoUnitario =
        Number(detalle.precioCompra) + Number(detalle.costoEnvio) + Number(detalle.costoSeguridad) + Number(detalle.costoLogistica);

      await tx.loteCompra.create({
        data: {
          varianteId: detalle.varianteId,
          almacenId: proforma.almacenRecepcionId,
          proformaDetalleId: detalle.id,
          costoUnitario,
          cantidadInicial: detalle.cantidad,
          cantidadDisponible: detalle.cantidad,
        },
      });

      await tx.stock.update({
        where: { varianteId_almacenId: { varianteId: detalle.varianteId, almacenId: proforma.almacenRecepcionId } },
        data: { cantidadFisica: { increment: detalle.cantidad } },
      });
    }
  }

  /** FIFO: descuenta Stock reservado/físico y consume LoteCompra en orden de fecha (más antiguo primero). */
  private async completarVenta(tx: Prisma.TransactionClient, proformaId: string) {
    const detalles = await tx.proformaDetalle.findMany({
      where: { proformaId },
      include: { asignaciones: { where: { origen: OrigenAsignacion.STOCK } } },
    });

    const pares = detalles.flatMap((d) =>
      d.asignaciones.map((a) => ({ varianteId: d.varianteId, almacenId: a.almacenId! })),
    );
    if (pares.length === 0) return;
    await lockStockRows(tx, pares);

    for (const detalle of detalles) {
      for (const asignacion of detalle.asignaciones) {
        const almacenId = asignacion.almacenId!;
        await tx.stock.update({
          where: { varianteId_almacenId: { varianteId: detalle.varianteId, almacenId } },
          data: {
            cantidadFisica: { decrement: asignacion.cantidad },
            cantidadReservada: { decrement: asignacion.cantidad },
          },
        });
        await this.consumirFifo(tx, detalle.varianteId, almacenId, asignacion.id, asignacion.cantidad);
      }
    }
  }

  private async consumirFifo(
    tx: Prisma.TransactionClient,
    varianteId: string,
    almacenId: string,
    asignacionId: string,
    cantidadRequerida: number,
  ) {
    const lotes = await tx.$queryRaw<LoteRow[]>`
      SELECT "id", "cantidad_disponible" FROM "lotes_compra"
      WHERE "variante_id" = ${varianteId}::uuid AND "almacen_id" = ${almacenId}::uuid AND "cantidad_disponible" > 0
      ORDER BY "fecha" ASC, "id" ASC
      FOR UPDATE
    `;

    let restante = cantidadRequerida;
    for (const lote of lotes) {
      if (restante <= 0) break;
      const tomar = Math.min(lote.cantidad_disponible, restante);
      await tx.loteCompra.update({ where: { id: lote.id }, data: { cantidadDisponible: { decrement: tomar } } });
      await tx.loteCompraConsumo.create({
        data: { loteCompraId: lote.id, proformaDetalleAsignacionId: asignacionId, cantidad: tomar },
      });
      restante -= tomar;
    }

    if (restante > 0) {
      throw new ConflictException(
        `Inconsistencia de stock: no hay lotes suficientes para cubrir la venta de la variante ${varianteId} ` +
          `en el almacén ${almacenId} (faltan ${restante} unidades). Revisar movimientos de stock manuales.`,
      );
    }
  }

  /**
   * Punto de extensión para integraciones futuras (facturación/contabilidad) al completar una
   * proforma — hoy no hace nada. Se llama al final de ambos flujos de completado (COMPRA y VENTA).
   */
  private async onProformaCompletada(proformaId: string, _tx: Prisma.TransactionClient): Promise<void> {
    this.logger.debug(`onProformaCompletada(${proformaId}): sin integraciones configuradas todavía.`);
  }
}
