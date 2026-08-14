import { BadRequestException, Injectable } from "@nestjs/common";
import { NaturalezaMovimiento, Prisma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CarteraService } from "./cartera.service";
import { lockCarteras } from "./cartera-lock.util";
import { CreateMovimientoDto } from "./dto/create-movimiento.dto";
import { QueryMovimientoDto } from "./dto/query-movimiento.dto";

const movimientoInclude = {
  tipoMovimiento: { select: { id: true, nombre: true, naturaleza: true } },
  traspaso: {
    select: {
      id: true,
      carteraOrigen: { select: { id: true, nombre: true } },
      carteraDestino: { select: { id: true, nombre: true } },
    },
  },
} satisfies Prisma.MovimientoCarteraInclude;

/**
 * El saldo acumulado ("Total") no está guardado — se recalcula acá, en memoria, cada vez que se
 * listan movimientos. Ver el doc-comment de MovimientoCartera en el schema para el porqué (fecha
 * editable + inmutabilidad). A la escala de una caja chica esto es trivial: se trae TODO el
 * historial de la cartera, se ordena por fecha, se acumula, y recién ahí se filtra por rango de
 * fecha y se pagina — así el Total de cada fila siempre refleja el saldo real a esa fecha, sin
 * importar qué filtro esté aplicado en la vista.
 */
@Injectable()
export class MovimientoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carteras: CarteraService,
  ) {}

  async findAll(carteraId: string, query: QueryMovimientoDto) {
    await this.carteras.findOne(carteraId);

    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });

    const todos = await this.prisma.movimientoCartera.findMany({
      where: { carteraId },
      orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
      include: movimientoInclude,
    });

    let saldo = 0;
    const conTotal = todos.map((movimiento) => {
      saldo += movimiento.naturaleza === NaturalezaMovimiento.INGRESO ? Number(movimiento.monto) : -Number(movimiento.monto);
      return { ...movimiento, total: saldo };
    });

    const desde = query.fechaDesde ? new Date(query.fechaDesde) : undefined;
    const hasta = query.fechaHasta ? new Date(query.fechaHasta) : undefined;
    if (hasta) hasta.setHours(23, 59, 59, 999);

    const filtrados = conTotal.filter((m) => (!desde || m.fecha >= desde) && (!hasta || m.fecha <= hasta));
    const masRecientePrimero = filtrados.slice().reverse();
    const items = masRecientePrimero.slice(skip, skip + take);

    return { items, total: filtrados.length, page, pageSize };
  }

  async create(carteraId: string, dto: CreateMovimientoDto, usuarioId: string) {
    await this.carteras.findOne(carteraId);

    const tipo = await this.prisma.tipoMovimiento.findUnique({ where: { id: dto.tipoMovimientoId } });
    if (!tipo || tipo.carteraId !== carteraId) {
      throw new BadRequestException("tipoMovimientoId inválido para esta cartera.");
    }
    if (tipo.naturaleza !== dto.naturaleza) {
      throw new BadRequestException(`El tipo elegido es de naturaleza ${tipo.naturaleza}, no coincide con la naturaleza indicada.`);
    }

    const delta = dto.naturaleza === NaturalezaMovimiento.INGRESO ? dto.monto : -dto.monto;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
        await lockCarteras(tx, [carteraId]);

        const movimiento = await tx.movimientoCartera.create({
          data: {
            carteraId,
            fecha: new Date(),
            detalle: dto.detalle,
            naturaleza: dto.naturaleza,
            monto: dto.monto,
            tipoMovimientoId: dto.tipoMovimientoId,
            creadoPorId: usuarioId,
          },
          include: movimientoInclude,
        });

        await tx.cartera.update({ where: { id: carteraId }, data: { saldoActual: { increment: delta } } });

        return movimiento;
      });
    } catch (error) {
      rethrowPrismaError(error, "Movimiento");
    }
  }
}
