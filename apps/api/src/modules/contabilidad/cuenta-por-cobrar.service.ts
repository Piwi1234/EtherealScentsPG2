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
      estado: true,
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

  private buildWhere(query: Pick<QueryCuentaPorCobrarDto, "estado" | "clienteId" | "codigo" | "fechaDesde" | "fechaHasta">): Prisma.CuentaPorCobrarWhereInput {
    const hasta = query.fechaHasta ? new Date(query.fechaHasta) : undefined;
    if (hasta) hasta.setUTCHours(23, 59, 59, 999);

    return {
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
  }

  async findAll(query: QueryCuentaPorCobrarDto) {
    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });

    const where = this.buildWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.cuentaPorCobrar.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include }),
      this.prisma.cuentaPorCobrar.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Las mismas cuentas, pero agrupadas por cliente y paginadas POR CLIENTE (no por cuenta): así las deudas de un mismo cliente
   * nunca quedan partidas entre dos páginas y sus totales cubren todo lo filtrado. Orden: mayor saldo pendiente primero. Una
   * cuenta sin cliente es su propio grupo (clienteId null). Se agrupa en memoria sobre una consulta liviana (la cantidad de
   * cuentas abiertas es chica) y recién después se trae el detalle completo de los clientes de la página.
   */
  async findAllPorCliente(query: QueryCuentaPorCobrarDto) {
    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });
    const where = this.buildWhere(query);

    const livianas = await this.prisma.cuentaPorCobrar.findMany({
      where,
      select: { id: true, montoAdeudado: true, proforma: { select: { clienteId: true } } },
    });
    const grupos = new Map<string, { clienteId: string | null; ids: string[]; adeudado: number }>();
    for (const c of livianas) {
      const clave = c.proforma.clienteId ?? `sin-cliente:${c.id}`;
      const g = grupos.get(clave) ?? { clienteId: c.proforma.clienteId, ids: [], adeudado: 0 };
      g.ids.push(c.id);
      g.adeudado += Number(c.montoAdeudado);
      grupos.set(clave, g);
    }
    const ordenados = [...grupos.values()].sort((a, b) => b.adeudado - a.adeudado);
    const pagina = ordenados.slice(skip, skip + take);

    const cuentas = await this.prisma.cuentaPorCobrar.findMany({
      where: { id: { in: pagina.flatMap((g) => g.ids) } },
      orderBy: { proforma: { fecha: "desc" } },
      include,
    });
    const porId = new Map(cuentas.map((c) => [c.id, c]));

    const items = pagina.map((g) => {
      const filas = g.ids.map((id) => porId.get(id)!).sort((a, b) => b.proforma.fecha.getTime() - a.proforma.fecha.getTime());
      const montoTotal = filas.reduce((n, c) => n + Number(c.montoTotal), 0);
      const montoAdeudado = filas.reduce((n, c) => n + Number(c.montoAdeudado), 0);
      return {
        clienteId: g.clienteId,
        cliente: filas[0]?.proforma.cliente ?? null,
        cantidad: filas.length,
        montoTotal: montoTotal.toFixed(2),
        montoCobrado: (montoTotal - montoAdeudado).toFixed(2),
        montoAdeudado: montoAdeudado.toFixed(2),
        cuentas: filas,
      };
    });

    return { items, total: ordenados.length, page, pageSize };
  }

  /** Deudas PENDIENTES de un cliente (para su estado de cuenta en PDF), de la más antigua a la más reciente; respeta el rango de fechas. */
  async pendientesDeCliente(clienteId: string, query: Pick<QueryCuentaPorCobrarDto, "fechaDesde" | "fechaHasta">) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true, nombre: true } });
    if (!cliente) throw new NotFoundException("Cliente no encontrado.");
    const cuentas = await this.prisma.cuentaPorCobrar.findMany({
      where: this.buildWhere({ ...query, clienteId, estado: EstadoCuentaPorCobrar.PENDIENTE }),
      orderBy: { proforma: { fecha: "asc" } },
      include,
    });
    return { cliente, cuentas };
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
