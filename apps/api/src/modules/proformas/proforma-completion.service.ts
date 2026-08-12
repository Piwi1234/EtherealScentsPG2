import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { EstadoProforma, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { ProformaHistorialService } from "./proforma-historial.service";
import { ProformasService } from "./proformas.service";
import { lockStockRows, stockKey } from "./stock-lock.util";
import { resolverProcuraPendiente } from "./procura.util";
import { AsignacionLoteDto, CompletarProformaDto } from "./dto/completar-proforma.dto";

/**
 * Completado: sincronización de costeo (COMPRA — crea LoteCompra + stock, nunca toca el catálogo; y
 * de paso resuelve sola cualquier Procura pendiente de ventas ya aprobadas para la misma
 * variante+almacén) y consumo de lotes (VENTA — descuenta Stock reservado/físico según el reparto de
 * lotes que trae el usuario a mano, ya no un FIFO automático).
 */
@Injectable()
export class ProformaCompletionService {
  private readonly logger = new Logger(ProformaCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly historial: ProformaHistorialService,
    private readonly proformas: ProformasService,
  ) {}

  async completar(id: string, usuarioId: string, dto: CompletarProformaDto) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;

          const rows = await tx.$queryRaw<{ estado: EstadoProforma; tipo: TipoProforma; almacenId: string | null }[]>`
            SELECT "estado", "tipo", "almacen_id" AS "almacenId" FROM "proformas" WHERE "id" = ${id}::uuid FOR UPDATE
          `;
          const lock = rows[0];
          if (!lock) throw new NotFoundException("Proforma no encontrada.");
          if (lock.estado !== EstadoProforma.APROBADA) {
            throw new ConflictException(`No se puede completar: la proforma está en estado ${lock.estado}.`);
          }

          if (lock.tipo === TipoProforma.COMPRA) {
            if (!dto.almacenId) throw new BadRequestException("almacenId es obligatorio para completar una proforma de compra.");
            const almacen = await tx.almacen.findUnique({ where: { id: dto.almacenId } });
            if (!almacen) throw new BadRequestException(`almacenId inválido: ${dto.almacenId}`);

            await tx.proforma.update({ where: { id }, data: { almacenId: dto.almacenId } });
            await this.completarCompra(tx, id, dto.almacenId);
          } else {
            if (!lock.almacenId) throw new ConflictException("La proforma no tiene almacén asignado (debería haberse fijado al aprobar).");
            await this.assertSinProcuraPendiente(tx, id);
            if (!dto.asignaciones || dto.asignaciones.length === 0) {
              throw new BadRequestException("Falta el reparto de lotes (asignaciones) para completar la venta.");
            }
            await this.completarVenta(tx, id, lock.almacenId, dto.asignaciones);
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

  private async assertSinProcuraPendiente(tx: Prisma.TransactionClient, proformaId: string) {
    const procuras = await tx.proformaDetalleAsignacion.findMany({
      where: { origen: OrigenAsignacion.PROCURA, cantidad: { gt: 0 }, proformaDetalle: { proformaId } },
      include: { proformaDetalle: { include: { variante: { include: { product: true } } } } },
    });
    if (procuras.length === 0) return;

    const detalleMsg = procuras
      .map((p) => `${p.proformaDetalle.variante.product.name} (${p.proformaDetalle.variante.variantCode}): faltan ${p.cantidad}`)
      .join(", ");
    throw new ConflictException(`No se puede completar: todavía falta stock para ${detalleMsg}.`);
  }

  /**
   * Crea un LoteCompra por línea con el costo real de esa compra e incrementa el stock físico del
   * almacén. El catálogo (Product/ProductVariant) NUNCA se toca acá. Después de sumar el stock de cada
   * línea, resuelve sola cualquier Procura pendiente de ventas ya aprobadas para esa misma
   * variante+almacén (por orden de aprobación, la más antigua primero) — reserva el stock recién
   * llegado contra ellas, convirtiendo Procura en Reservado sin intervención manual.
   */
  private async completarCompra(tx: Prisma.TransactionClient, proformaId: string, almacenId: string) {
    const proforma = await tx.proforma.findUniqueOrThrow({
      where: { id: proformaId },
      include: { detalles: true },
    });
    if (proforma.detalles.length === 0) {
      throw new ConflictException("La proforma no tiene líneas.");
    }

    const pares = proforma.detalles.map((d) => ({ varianteId: d.varianteId, almacenId }));
    const stockPorPar = await lockStockRows(tx, pares);

    for (const detalle of proforma.detalles) {
      const costoUnitario =
        Number(detalle.precioCompra) + Number(detalle.costoEnvio) + Number(detalle.costoSeguridad) + Number(detalle.costoLogistica);

      await tx.loteCompra.create({
        data: {
          varianteId: detalle.varianteId,
          almacenId,
          proformaDetalleId: detalle.id,
          costoUnitario,
          cantidadInicial: detalle.cantidad,
          cantidadDisponible: detalle.cantidad,
        },
      });

      await tx.stock.update({
        where: { varianteId_almacenId: { varianteId: detalle.varianteId, almacenId } },
        data: { cantidadFisica: { increment: detalle.cantidad } },
      });

      const stock = stockPorPar.get(stockKey(detalle.varianteId, almacenId))!;
      stock.cantidadFisica += detalle.cantidad;
      const disponible = stock.cantidadFisica - stock.cantidadReservada;

      await resolverProcuraPendiente(tx, { varianteId: detalle.varianteId, almacenId, disponible });
    }
  }

  /**
   * Descuenta Stock reservado/físico y consume los lotes que el usuario repartió a mano (ya no hay
   * FIFO automático — el reparto llega en `asignacionesInput`, validado contra cada asignación STOCK
   * de la proforma).
   */
  private async completarVenta(
    tx: Prisma.TransactionClient,
    proformaId: string,
    almacenId: string,
    asignacionesInput: AsignacionLoteDto[],
  ) {
    const asignacionesStock = await tx.proformaDetalleAsignacion.findMany({
      where: { origen: OrigenAsignacion.STOCK, proformaDetalle: { proformaId } },
      include: { proformaDetalle: { include: { variante: { include: { product: true } } } } },
    });

    const sumaPorAsignacion = new Map<string, number>();
    for (const entrada of asignacionesInput) {
      sumaPorAsignacion.set(
        entrada.proformaDetalleAsignacionId,
        (sumaPorAsignacion.get(entrada.proformaDetalleAsignacionId) ?? 0) + entrada.cantidad,
      );
    }

    const descuadradas: string[] = [];
    for (const asignacion of asignacionesStock) {
      const suma = sumaPorAsignacion.get(asignacion.id) ?? 0;
      if (suma !== asignacion.cantidad) {
        descuadradas.push(
          `${asignacion.proformaDetalle.variante.product.name} (${asignacion.proformaDetalle.variante.variantCode}): ` +
            `se repartieron ${suma}, se necesitan ${asignacion.cantidad}`,
        );
      }
    }
    if (descuadradas.length > 0) {
      throw new BadRequestException(`El reparto de lotes no cuadra: ${descuadradas.join(", ")}.`);
    }
    const asignacionIdsValidas = new Set(asignacionesStock.map((a) => a.id));
    if (asignacionesInput.some((e) => !asignacionIdsValidas.has(e.proformaDetalleAsignacionId))) {
      throw new BadRequestException("Alguna asignación del reparto no pertenece a esta proforma.");
    }

    for (const entrada of asignacionesInput) {
      const resultado = await tx.loteCompra.updateMany({
        where: { id: entrada.loteCompraId, cantidadDisponible: { gte: entrada.cantidad } },
        data: { cantidadDisponible: { decrement: entrada.cantidad } },
      });
      if (resultado.count === 0) {
        throw new ConflictException(`El lote ${entrada.loteCompraId} ya no tiene ${entrada.cantidad} unidad(es) disponibles.`);
      }
      await tx.loteCompraConsumo.create({
        data: {
          loteCompraId: entrada.loteCompraId,
          proformaDetalleAsignacionId: entrada.proformaDetalleAsignacionId,
          cantidad: entrada.cantidad,
        },
      });
    }

    const pares = asignacionesStock.map((a) => ({ varianteId: a.proformaDetalle.varianteId, almacenId }));
    await lockStockRows(tx, pares);
    for (const asignacion of asignacionesStock) {
      await tx.stock.update({
        where: { varianteId_almacenId: { varianteId: asignacion.proformaDetalle.varianteId, almacenId } },
        data: { cantidadFisica: { decrement: asignacion.cantidad }, cantidadReservada: { decrement: asignacion.cantidad } },
      });
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
