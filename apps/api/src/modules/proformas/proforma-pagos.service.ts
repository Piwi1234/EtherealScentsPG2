import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoCuentaPorCobrar, EstadoProforma, MonedaCartera, NaturalezaMovimiento, Prisma, TipoProforma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { lockCarteras } from "../contabilidad/cartera-lock.util";
import { calcularTotalesVenta } from "./proforma-totales.util";
import { RegistrarPagoDto } from "./dto/registrar-pago.dto";

/**
 * Neto cobrado de una venta: ingresos de cartera ligados a la proforma menos sus reversos (los gastos
 * que genera la anulación). Es lo único que cuenta como "pagado": el adelanto registrado al aprobar,
 * los pagos hechos antes de completar y los cobros de la Cuenta por Cobrar son todos el mismo tipo de
 * movimiento, así que no hay un campo aparte que mantener sincronizado.
 */
export async function totalPagado(tx: Prisma.TransactionClient | PrismaService, proformaId: string): Promise<number> {
  const grupos = await tx.movimientoCartera.groupBy({
    by: ["naturaleza"],
    where: { proformaId },
    _sum: { monto: true },
  });
  let neto = 0;
  for (const g of grupos) {
    const monto = Number(g._sum.monto ?? 0);
    neto += g.naturaleza === NaturalezaMovimiento.INGRESO ? monto : -monto;
  }
  return Math.round(neto * 100) / 100;
}

/**
 * Pagos de una venta mientras está APROBADA: el cliente puede ir pagando antes de que se complete
 * (adelanto, abonos), y todo queda en la contabilidad (cartera) en el momento. Al completar, la
 * Cuenta por Cobrar nace solo con lo que todavía falta (ver proforma-completion.service.ts).
 */
@Injectable()
export class ProformaPagosService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen(id: string) {
    const proforma = await this.prisma.proforma.findUnique({ where: { id }, include: { detalles: true } });
    if (!proforma) throw new NotFoundException("Proforma no encontrada.");
    if (proforma.tipo !== TipoProforma.VENTA) throw new BadRequestException("Solo las proformas de venta tienen pagos.");

    const { total, montoAdelanto } = calcularTotalesVenta(proforma);
    const movimientos = await this.prisma.movimientoCartera.findMany({
      where: { proformaId: id },
      orderBy: { createdAt: "asc" },
      include: { cartera: { select: { id: true, nombre: true, moneda: true } }, creadoPor: { select: { id: true, nombre: true } } },
    });
    const pagado = await totalPagado(this.prisma, id);
    const saldo = Math.round((total - pagado) * 100) / 100;
    return {
      total,
      montoAdelanto,
      adelantoPendiente: Math.max(0, Math.round((montoAdelanto - pagado) * 100) / 100),
      pagado,
      saldo,
      movimientos,
    };
  }

  async registrar(id: string, dto: RegistrarPagoDto, usuarioId: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;

          const rows = await tx.$queryRaw<{ estado: EstadoProforma; tipo: TipoProforma }[]>`
            SELECT "estado", "tipo" FROM "proformas" WHERE "id" = ${id}::uuid FOR UPDATE
          `;
          const lock = rows[0];
          if (!lock) throw new NotFoundException("Proforma no encontrada.");
          if (lock.tipo !== TipoProforma.VENTA) throw new BadRequestException("Solo las proformas de venta tienen pagos.");
          if (lock.estado !== EstadoProforma.APROBADA) {
            throw new ConflictException(
              lock.estado === EstadoProforma.COMPLETADA
                ? "La venta ya está completada: el saldo se cobra desde Cuentas por Cobrar."
                : `No se puede registrar un pago: la proforma está en estado ${lock.estado}.`,
            );
          }

          const proforma = await tx.proforma.findUniqueOrThrow({ where: { id }, include: { detalles: true, cliente: true } });
          const { total } = calcularTotalesVenta(proforma);
          const pagado = await totalPagado(tx, id);
          const saldo = Math.round((total - pagado) * 100) / 100;
          if (dto.monto > saldo + 0.001) {
            throw new BadRequestException(`El pago no puede superar el saldo pendiente (Bs ${saldo.toFixed(2)}).`);
          }

          const cartera = await tx.cartera.findUnique({ where: { id: dto.carteraId } });
          if (!cartera || !cartera.activo) throw new BadRequestException(`carteraId inválido o inactivo: ${dto.carteraId}`);
          if (cartera.moneda !== MonedaCartera.BS) throw new BadRequestException("La cartera del pago debe ser en Bs.");

          await lockCarteras(tx, [dto.carteraId]);
          const nota = dto.nota?.trim();
          await tx.movimientoCartera.create({
            data: {
              carteraId: dto.carteraId,
              fecha: new Date(),
              detalle: `CL: ${proforma.cliente?.nombre ?? "—"} - PR: ${proforma.codigo} - PAGO${nota ? ` - ${nota}` : ""}`,
              naturaleza: NaturalezaMovimiento.INGRESO,
              monto: dto.monto,
              proformaId: id,
              creadoPorId: usuarioId,
            },
          });
          await tx.cartera.update({ where: { id: dto.carteraId }, data: { saldoActual: { increment: dto.monto } } });

          // La cuenta por cobrar (nace al aprobar) baja con cada pago.
          const nuevoSaldo = Math.max(0, Math.round((total - pagado - dto.monto) * 100) / 100);
          await tx.cuentaPorCobrar.updateMany({
            where: { proformaId: id },
            data: { montoAdeudado: nuevoSaldo, estado: nuevoSaldo <= 0 ? EstadoCuentaPorCobrar.COMPLETADO : EstadoCuentaPorCobrar.PENDIENTE },
          });
        },
        { timeout: 15000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Pago");
    }
    return this.resumen(id);
  }
}
