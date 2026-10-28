import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { EstadoCuentaPorCobrar, EstadoProforma, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { ProformaHistorialService } from "./proforma-historial.service";
import { ProformasService } from "./proformas.service";
import { lockStockRows, stockKey } from "./stock-lock.util";
import { resolverProcuraPendiente } from "./procura.util";
import { calcularTotalesVenta } from "./proforma-totales.util";
import { totalPagado } from "./proforma-pagos.service";
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
            // Una compra solo se completa al confirmar la recepción de su envío (ver
            // EnviosService.confirmarRecepcion): ahí se corrige lo que realmente llegó antes de
            // crear lotes y stock.
            throw new ConflictException("Una compra se completa al recibir su envío: agregala a un envío y confirmá la recepción.");
          } else {
            if (!lock.almacenId) throw new ConflictException("La proforma no tiene almacén asignado (debería haberse fijado al aprobar).");
            await this.assertSinProcuraPendiente(tx, id);
            // Lo ya entregado (entregas parciales) no vuelve a repartirse: solo hace falta repartir lo que sigue reservado.
            const pendientesStock = await tx.proformaDetalleAsignacion.count({
              where: { origen: OrigenAsignacion.STOCK, cantidad: { gt: 0 }, proformaDetalle: { proformaId: id } },
            });
            if (pendientesStock > 0 && (!dto.asignaciones || dto.asignaciones.length === 0)) {
              throw new BadRequestException("Falta el reparto de lotes (asignaciones) para completar la venta.");
            }
            await this.completarVenta(tx, id, lock.almacenId, dto.asignaciones ?? []);
          }

          await this.finalizarVenta(tx, id, usuarioId, lock.tipo === TipoProforma.VENTA);
        },
        { timeout: 15000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }
    return this.proformas.findOne(id);
  }

  /** Cierra la nota: pasa a COMPLETADA, deja el historial y asegura su cuenta por cobrar. También la usa la entrega
   * parcial cuando la última unidad sale (ver proforma-entrega.service.ts). */
  async finalizarVenta(tx: Prisma.TransactionClient, id: string, usuarioId: string, esVenta: boolean, nota?: string) {
    await tx.proforma.update({ where: { id }, data: { estado: EstadoProforma.COMPLETADA } });
    await this.historial.registrar(tx, id, EstadoProforma.COMPLETADA, usuarioId, nota);
    if (esVenta) await this.crearCuentaPorCobrarSiCorresponde(tx, id);
  }

  private async assertSinProcuraPendiente(tx: Prisma.TransactionClient, proformaId: string) {
    const procuras = await tx.proformaDetalleAsignacion.findMany({
      where: { origen: { in: [OrigenAsignacion.PROCURA, OrigenAsignacion.EN_TRANSITO] }, cantidad: { gt: 0 }, proformaDetalle: { proformaId } },
      include: { proformaDetalle: { include: { variante: { include: { product: true } } } } },
    });
    if (procuras.length === 0) return;

    const detalleMsg = procuras
      .map((p) => `${p.proformaDetalle.variante.product.name} (${p.proformaDetalle.variante.variantCode}): faltan ${p.cantidad}${p.origen === OrigenAsignacion.EN_TRANSITO ? " (reservadas en tránsito, todavía no llegaron)" : ""}`)
      .join(", ");
    throw new ConflictException(`No se puede completar: todavía falta stock para ${detalleMsg}.`);
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
   * Al completar una VENTA: si queda saldo pendiente (total - adelanto ya cobrado > 0), crea la
   * Cuenta por Cobrar con ese saldo — el "monto a cancelar" que se pide justo después de completar
   * (ver ProformaAcciones/CompletarVentaForm en el frontend) es, ni más ni menos, el primer cobro
   * contra esta misma fila (mismo endpoint que usa el gestor de Cuentas por Cobrar). Si no queda
   * saldo (sin adelanto pero total=0, o adelanto al 100%) no se crea nada — no hay nada que cobrar.
   */
  private async crearCuentaPorCobrarSiCorresponde(tx: Prisma.TransactionClient, proformaId: string): Promise<void> {
    // La cuenta por cobrar nace al aprobar la venta (ver proforma-approval.service.ts): acá solo se
    // asegura que exista, por si la venta se aprobó antes de ese cambio.
    if (await tx.cuentaPorCobrar.findUnique({ where: { proformaId } })) return;

    const proforma = await tx.proforma.findUniqueOrThrow({ where: { id: proformaId }, include: { detalles: true } });
    const { total } = calcularTotalesVenta(proforma);
    const saldo = Math.round((total - (await totalPagado(tx, proformaId))) * 100) / 100;
    await tx.cuentaPorCobrar.create({
      data: {
        proformaId,
        montoTotal: total,
        montoAdeudado: Math.max(0, saldo),
        estado: saldo <= 0 ? EstadoCuentaPorCobrar.COMPLETADO : EstadoCuentaPorCobrar.PENDIENTE,
      },
    });
    this.logger.debug(`Cuenta por cobrar creada para proforma ${proformaId}: Bs ${saldo}.`);
  }
}
