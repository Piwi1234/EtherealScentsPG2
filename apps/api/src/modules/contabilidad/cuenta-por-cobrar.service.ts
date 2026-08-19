import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoCuentaPorCobrar, MonedaCartera, NaturalezaMovimiento, Prisma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { lockCarteras } from "./cartera-lock.util";
import { CobrarCuentaDto } from "./dto/cobrar-cuenta.dto";
import { QueryCuentaPorCobrarDto } from "./dto/query-cuenta-por-cobrar.dto";

const include = {
  proforma: {
    select: {
      id: true,
      codigo: true,
      fecha: true,
      cliente: { select: { id: true, nombre: true } },
    },
  },
} satisfies Prisma.CuentaPorCobrarInclude;

/**
 * Gestor de cobros: una fila por VENTA completada que quedó con saldo pendiente (ver
 * proforma-completion.service.ts). El "cobrar" acá es el mismo endpoint que usa el paso de pago
 * justo después de completar una venta (CompletarVentaForm en el frontend) — no hay dos caminos de
 * código para lo mismo, solo dos puntos de entrada a la UI.
 */
@Injectable()
export class CuentaPorCobrarService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryCuentaPorCobrarDto) {
    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });

    const hasta = query.fechaHasta ? new Date(query.fechaHasta) : undefined;
    if (hasta) hasta.setUTCHours(23, 59, 59, 999);

    const where: Prisma.CuentaPorCobrarWhereInput = {
      estado: query.estado,
      proforma: {
        clienteId: query.clienteId,
        codigo: query.codigo ? query.codigo.trim().toUpperCase() : undefined,
        fecha: {
          gte: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
          lte: hasta,
        },
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.cuentaPorCobrar.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include }),
      this.prisma.cuentaPorCobrar.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const cuenta = await this.prisma.cuentaPorCobrar.findUnique({ where: { id }, include });
    if (!cuenta) throw new NotFoundException("Cuenta por cobrar no encontrada.");
    return cuenta;
  }

  /** Cobro parcial o total contra una Cuenta por Cobrar: nunca más de lo adeudado, genera un
   * MovimientoCartera INGRESO en la cartera Bs elegida (ligado vía proformaId) y descuenta
   * montoAdeudado — al llegar a 0 la cuenta pasa a COMPLETADO. */
  async cobrar(id: string, dto: CobrarCuentaDto, usuarioId: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;

          const rows = await tx.$queryRaw<{ estado: EstadoCuentaPorCobrar; montoAdeudado: Prisma.Decimal; proformaId: string }[]>`
            SELECT "estado", "monto_adeudado" AS "montoAdeudado", "proforma_id" AS "proformaId"
            FROM "cuentas_por_cobrar" WHERE "id" = ${id}::uuid FOR UPDATE
          `;
          const lock = rows[0];
          if (!lock) throw new NotFoundException("Cuenta por cobrar no encontrada.");
          if (lock.estado !== EstadoCuentaPorCobrar.PENDIENTE) {
            throw new ConflictException("Esta cuenta por cobrar ya está completada.");
          }
          if (dto.monto > Number(lock.montoAdeudado)) {
            throw new BadRequestException(`No se puede cobrar más de lo adeudado (Bs ${lock.montoAdeudado}).`);
          }

          const cartera = await tx.cartera.findUnique({ where: { id: dto.carteraId } });
          if (!cartera || !cartera.activo) throw new BadRequestException(`carteraId inválido o inactivo: ${dto.carteraId}`);
          if (cartera.moneda !== MonedaCartera.BS) throw new BadRequestException("La cartera del cobro debe ser en Bs.");

          const proforma = await tx.proforma.findUniqueOrThrow({ where: { id: lock.proformaId }, include: { cliente: true } });

          await lockCarteras(tx, [dto.carteraId]);
          await tx.movimientoCartera.create({
            data: {
              carteraId: dto.carteraId,
              fecha: new Date(),
              detalle: `CL: ${proforma.cliente?.nombre ?? "—"} - PR: ${proforma.codigo} - COB`,
              naturaleza: NaturalezaMovimiento.INGRESO,
              monto: dto.monto,
              proformaId: proforma.id,
              creadoPorId: usuarioId,
            },
          });
          await tx.cartera.update({ where: { id: dto.carteraId }, data: { saldoActual: { increment: dto.monto } } });

          const nuevoSaldo = Math.round((Number(lock.montoAdeudado) - dto.monto) * 100) / 100;
          await tx.cuentaPorCobrar.update({
            where: { id },
            data: {
              montoAdeudado: nuevoSaldo,
              estado: nuevoSaldo <= 0 ? EstadoCuentaPorCobrar.COMPLETADO : EstadoCuentaPorCobrar.PENDIENTE,
            },
          });
        },
        { timeout: 15000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Cuenta por cobrar");
    }
    return this.findOne(id);
  }
}
