import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoEnvio, EstadoProforma, Prisma, TipoProforma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../../common/prisma.service";
import { rethrowPrismaError } from "../../../common/prisma-errors";
import { generateUniqueEntityCode } from "../../../catalog/entity-code";
import { ProformaHistorialService } from "../proforma-historial.service";
import { includeDetails } from "../proformas.service";
import { lockStockRows, stockKey } from "../stock-lock.util";
import { resolverProcuraPendiente } from "../procura.util";
import { CreateEnvioDto, QueryEnvioDto, UpdateEnvioDto, UpdateRecepcionLineaDto } from "./dto/envio.dto";

const varianteInclude = {
  product: { include: { brand: true } },
  options: { include: { optionValue: { include: { attribute: true } } } },
} satisfies Prisma.ProductVariantInclude;

const recepcionInclude = {
  compraDetalle: { select: { id: true, proformaId: true, proveedor: { select: { id: true, nombre: true } } } },
  varianteEsperada: { include: varianteInclude },
  varianteRecibida: { include: varianteInclude },
} satisfies Prisma.EnvioRecepcionLineaInclude;

const envioInclude = {
  almacenDestino: true,
  creadoPor: { select: { id: true, nombre: true } },
  compras: { include: includeDetails, orderBy: { createdAt: "asc" as const } },
  recepcion: { include: recepcionInclude, orderBy: { id: "asc" as const } },
} satisfies Prisma.EnvioInclude;

/**
 * Un envío agrupa varias compras (de varios proveedores) que viajan juntas hacia un almacén. Es el
 * ÚNICO camino para completar una compra: al confirmar la recepción se crean los lotes y el stock
 * con lo que realmente llegó (pudiendo corregir cantidades o el producto recibido antes de
 * confirmar) y recién ahí las compras pasan a COMPLETADA.
 */
@Injectable()
export class EnviosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historial: ProformaHistorialService,
  ) {}

  async findAll(query: QueryEnvioDto) {
    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });
    const where: Prisma.EnvioWhereInput = { estado: query.estado };
    const [items, total] = await Promise.all([
      this.prisma.envio.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          almacenDestino: true,
          creadoPor: { select: { id: true, nombre: true } },
          compras: { select: { id: true, codigo: true } },
        },
      }),
      this.prisma.envio.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const envio = await this.prisma.envio.findUnique({ where: { id }, include: envioInclude });
    if (!envio) throw new NotFoundException("Envío no encontrado.");
    return envio;
  }

  /** Compras APROBADAS que todavía no están en ningún envío — lo que se puede sumar a uno. */
  findComprasDisponibles() {
    return this.prisma.proforma.findMany({
      where: { tipo: TipoProforma.COMPRA, estado: EstadoProforma.APROBADA, envioId: null },
      orderBy: { createdAt: "asc" },
      include: includeDetails,
    });
  }

  private async assertAlmacenExists(id: string) {
    const almacen = await this.prisma.almacen.findUnique({ where: { id } });
    if (!almacen) throw new BadRequestException(`almacenDestinoId inválido: ${id}`);
  }

  private assertEstado(envio: { estado: EstadoEnvio }, permitidos: EstadoEnvio[], accion: string) {
    if (!permitidos.includes(envio.estado)) {
      throw new ConflictException(`No se puede ${accion}: el envío está en estado ${envio.estado}.`);
    }
  }

  private async assertCompraDisponible(tx: Prisma.TransactionClient, proformaId: string) {
    const compra = await tx.proforma.findUnique({
      where: { id: proformaId },
      select: { tipo: true, estado: true, envioId: true, codigo: true },
    });
    if (!compra) throw new BadRequestException(`Compra inválida: ${proformaId}`);
    if (compra.tipo !== TipoProforma.COMPRA) throw new BadRequestException(`${compra.codigo} no es una proforma de compra.`);
    if (compra.estado !== EstadoProforma.APROBADA) {
      throw new ConflictException(`${compra.codigo} tiene que estar APROBADA para entrar a un envío (está ${compra.estado}).`);
    }
    if (compra.envioId) throw new ConflictException(`${compra.codigo} ya está en otro envío.`);
  }

  private generateCodigo() {
    return generateUniqueEntityCode(async (code) => {
      const existing = await this.prisma.envio.findUnique({ where: { codigo: code }, select: { id: true } });
      return Boolean(existing);
    });
  }

  async create(dto: CreateEnvioDto, usuarioId: string) {
    await this.assertAlmacenExists(dto.almacenDestinoId);
    const codigo = await this.generateCodigo();
    try {
      const envio = await this.prisma.$transaction(async (tx) => {
        for (const compraId of dto.compraIds ?? []) await this.assertCompraDisponible(tx, compraId);
        const creado = await tx.envio.create({
          data: { codigo, almacenDestinoId: dto.almacenDestinoId, nota: dto.nota, creadoPorId: usuarioId },
        });
        if (dto.compraIds?.length) {
          await tx.proforma.updateMany({ where: { id: { in: dto.compraIds } }, data: { envioId: creado.id } });
        }
        return creado;
      });
      return this.findOne(envio.id);
    } catch (error) {
      rethrowPrismaError(error, "Envío");
    }
  }

  async update(id: string, dto: UpdateEnvioDto) {
    const envio = await this.findOne(id);
    this.assertEstado(envio, [EstadoEnvio.ARMANDO], "editar");
    if (dto.almacenDestinoId) await this.assertAlmacenExists(dto.almacenDestinoId);
    await this.prisma.envio.update({ where: { id }, data: { almacenDestinoId: dto.almacenDestinoId, nota: dto.nota } });
    return this.findOne(id);
  }

  async agregarCompra(id: string, proformaId: string) {
    const envio = await this.findOne(id);
    this.assertEstado(envio, [EstadoEnvio.ARMANDO], "agregar compras");
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.assertCompraDisponible(tx, proformaId);
        await tx.proforma.update({ where: { id: proformaId }, data: { envioId: id } });
        // La foto de recepción (si ya se abrió) quedaría desactualizada: se regenera al reabrirla.
        await tx.envioRecepcionLinea.deleteMany({ where: { envioId: id } });
      });
    } catch (error) {
      rethrowPrismaError(error, "Envío");
    }
    return this.findOne(id);
  }

  async quitarCompra(id: string, proformaId: string) {
    const envio = await this.findOne(id);
    this.assertEstado(envio, [EstadoEnvio.ARMANDO], "quitar compras");
    if (!envio.compras.some((c) => c.id === proformaId)) throw new NotFoundException("Esa compra no está en este envío.");
    await this.prisma.$transaction(async (tx) => {
      await tx.envioRecepcionLinea.deleteMany({ where: { envioId: id } });
      await tx.proforma.update({ where: { id: proformaId }, data: { envioId: null } });
    });
    return this.findOne(id);
  }

  async marcarEnTransito(id: string) {
    const envio = await this.findOne(id);
    this.assertEstado(envio, [EstadoEnvio.ARMANDO], "marcar en tránsito");
    if (envio.compras.length === 0) throw new ConflictException("El envío no tiene compras.");
    await this.prisma.envio.update({ where: { id }, data: { estado: EstadoEnvio.EN_TRANSITO, fechaEnvio: new Date() } });
    return this.findOne(id);
  }

  async anular(id: string) {
    const envio = await this.findOne(id);
    this.assertEstado(envio, [EstadoEnvio.ARMANDO, EstadoEnvio.EN_TRANSITO], "anular");
    await this.prisma.$transaction(async (tx) => {
      await tx.envioRecepcionLinea.deleteMany({ where: { envioId: id } });
      await tx.proforma.updateMany({ where: { envioId: id }, data: { envioId: null } });
      await tx.envio.update({ where: { id }, data: { estado: EstadoEnvio.ANULADO } });
    });
    return this.findOne(id);
  }

  /** Genera la foto de lo esperado (una fila por línea de compra) para que el usuario la corrija con
   * lo que realmente llegó. Idempotente: si ya existe, la devuelve sin pisar correcciones. */
  async iniciarRecepcion(id: string) {
    const envio = await this.findOne(id);
    this.assertEstado(envio, [EstadoEnvio.ARMANDO, EstadoEnvio.EN_TRANSITO], "abrir la recepción");
    if (envio.compras.length === 0) throw new ConflictException("El envío no tiene compras.");
    if (envio.recepcion.length === 0) {
      const lineas = envio.compras.flatMap((c) =>
        c.detalles.map((d) => ({
          envioId: id,
          compraDetalleId: d.id,
          varianteEsperadaId: d.varianteId,
          varianteRecibidaId: d.varianteId,
          cantidadEsperada: d.cantidad,
          cantidadRecibida: d.cantidad,
        })),
      );
      await this.prisma.envioRecepcionLinea.createMany({ data: lineas });
    }
    return this.findOne(id);
  }

  async updateRecepcionLinea(id: string, lineaId: string, dto: UpdateRecepcionLineaDto) {
    const envio = await this.findOne(id);
    this.assertEstado(envio, [EstadoEnvio.ARMANDO, EstadoEnvio.EN_TRANSITO], "corregir la recepción");
    const linea = envio.recepcion.find((l) => l.id === lineaId);
    if (!linea) throw new NotFoundException("Línea de recepción no encontrada.");
    if (dto.varianteRecibidaId) {
      const variante = await this.prisma.productVariant.findUnique({ where: { id: dto.varianteRecibidaId }, select: { id: true } });
      if (!variante) throw new BadRequestException(`varianteRecibidaId inválida: ${dto.varianteRecibidaId}`);
    }
    await this.prisma.envioRecepcionLinea.update({
      where: { id: lineaId },
      data: { cantidadRecibida: dto.cantidadRecibida, varianteRecibidaId: dto.varianteRecibidaId, nota: dto.nota },
    });
    return this.findOne(id);
  }

  /**
   * Confirma lo recibido: por cada línea con unidades llegadas crea el LoteCompra (a nombre de la
   * variante que REALMENTE llegó, con el costo de la línea de compra) y suma stock físico en el
   * almacén destino; después resuelve la Procura pendiente de ventas aprobadas y completa las compras.
   * Todo en una sola transacción, con las filas de stock bloqueadas antes de tocar lotes.
   */
  async confirmarRecepcion(id: string, usuarioId: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          const rows = await tx.$queryRaw<{ estado: EstadoEnvio; almacenDestinoId: string }[]>`
            SELECT "estado", "almacen_destino_id" AS "almacenDestinoId" FROM "envios" WHERE "id" = ${id}::uuid FOR UPDATE
          `;
          const lock = rows[0];
          if (!lock) throw new NotFoundException("Envío no encontrado.");
          this.assertEstado(lock, [EstadoEnvio.ARMANDO, EstadoEnvio.EN_TRANSITO], "confirmar la recepción");

          const envio = await tx.envio.findUniqueOrThrow({
            where: { id },
            include: {
              compras: true,
              recepcion: {
                include: {
                  compraDetalle: true,
                  varianteEsperada: { include: { product: true } },
                  varianteRecibida: { include: { product: true } },
                },
              },
            },
          });
          if (envio.compras.length === 0) throw new ConflictException("El envío no tiene compras.");
          if (envio.recepcion.length === 0) throw new ConflictException("Abrí la recepción y revisá lo recibido antes de confirmar.");

          const almacenId = lock.almacenDestinoId;
          const recibidas = envio.recepcion.filter((l) => l.cantidadRecibida > 0);
          const pares = Array.from(new Set(recibidas.map((l) => l.varianteRecibidaId))).map((varianteId) => ({ varianteId, almacenId }));
          const stockPorPar = await lockStockRows(tx, pares);

          for (const linea of recibidas) {
            const d = linea.compraDetalle;
            const costoUnitario = Number(d.precioCompra) + Number(d.costoEnvio) + Number(d.costoSeguridad) + Number(d.costoLogistica);
            await tx.loteCompra.create({
              data: {
                varianteId: linea.varianteRecibidaId,
                almacenId,
                proformaDetalleId: d.id,
                costoUnitario,
                cantidadInicial: linea.cantidadRecibida,
                cantidadDisponible: linea.cantidadRecibida,
              },
            });
            await tx.stock.update({
              where: { varianteId_almacenId: { varianteId: linea.varianteRecibidaId, almacenId } },
              data: { cantidadFisica: { increment: linea.cantidadRecibida } },
            });
            stockPorPar.get(stockKey(linea.varianteRecibidaId, almacenId))!.cantidadFisica += linea.cantidadRecibida;
          }

          for (const par of pares) {
            const stock = stockPorPar.get(stockKey(par.varianteId, par.almacenId))!;
            await resolverProcuraPendiente(tx, { ...par, disponible: stock.cantidadFisica - stock.cantidadReservada });
          }

          const diferencias = envio.recepcion
            .filter((l) => l.cantidadRecibida !== l.cantidadEsperada || l.varianteRecibidaId !== l.varianteEsperadaId)
            .map((l) => {
              const esperado = `${l.varianteEsperada.product.name} x${l.cantidadEsperada}`;
              const recibido =
                l.varianteRecibidaId === l.varianteEsperadaId
                  ? `x${l.cantidadRecibida}`
                  : `${l.varianteRecibida.product.name} x${l.cantidadRecibida}`;
              return `${esperado} → ${recibido}`;
            });
          const nota = `Recibida en el envío ${envio.codigo}.${diferencias.length ? ` Diferencias: ${diferencias.join("; ")}.` : ""}`;

          for (const compra of envio.compras) {
            await tx.proforma.update({ where: { id: compra.id }, data: { estado: EstadoProforma.COMPLETADA, almacenId } });
            await this.historial.registrar(tx, compra.id, EstadoProforma.COMPLETADA, usuarioId, nota);
          }
          await tx.envio.update({ where: { id }, data: { estado: EstadoEnvio.RECIBIDO, fechaRecepcion: new Date() } });
        },
        { timeout: 20000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Envío");
    }
    return this.findOne(id);
  }
}
