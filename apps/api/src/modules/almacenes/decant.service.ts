import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, TipoMovimientoDecant, UnidadVariante } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { lockStockRows, stockKey } from "../proformas/stock-lock.util";
import { BajaMlDto, ConvertirDecantDto } from "./dto/decant.dto";

const varianteSelect = {
  id: true,
  variantCode: true,
  unidad: true,
  product: {
    select: {
      id: true,
      name: true,
      productCode: true,
      brand: { select: { id: true, name: true } },
      attributeValues: { include: { attribute: true, option: true } },
      variantOptionValues: { include: { attribute: true } },
    },
  },
  options: { include: { optionValue: { include: { attribute: true } } } },
} satisfies Prisma.ProductVariantSelect;

const movimientoInclude = {
  variante: { select: varianteSelect },
  varianteOrigen: { select: varianteSelect },
  almacen: { select: { id: true, nombre: true } },
  creadoPor: { select: { id: true, nombre: true } },
} satisfies Prisma.MovimientoDecantInclude;

const redondear2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Decants de perfumes: convierte frascos del stock en ml de la variante Decants (mismo producto, unidad ML) heredando el
 * costo real del lote, y da de baja ml perdidos. La venta por presentaciones (2, 5, 10 ml...) ya descuenta de esos ml.
 * Ver MovimientoDecant en schema.prisma.
 */
@Injectable()
export class DecantService {
  constructor(private readonly prisma: PrismaService) {}

  /** Variantes Decants (unidad ML) de un producto — destinos posibles al convertir un frasco de ese producto. */
  async destinos(varianteOrigenId: string) {
    const origen = await this.prisma.productVariant.findUnique({ where: { id: varianteOrigenId }, select: { productId: true, unidad: true } });
    if (!origen) throw new NotFoundException("Variante no encontrada.");
    if (origen.unidad !== UnidadVariante.PZA) return [];
    return this.prisma.productVariant.findMany({
      where: { productId: origen.productId, unidad: UnidadVariante.ML },
      select: varianteSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Costo promedio por ml (en Bs, al tipo de cambio de cada compra) de los ml que hay ahora en una variante Decants:
   * es lo que cuesta cada ml de las presentaciones, antes del empaque. null si no hay ml con costo.
   */
  async costoPromedioMl(varianteId: string) {
    const lotes = await this.prisma.loteCompra.findMany({
      where: { varianteId, cantidadDisponible: { gt: 0 } },
      select: { cantidadDisponible: true, costoUnitario: true, proformaDetalle: { select: { proforma: { select: { tipoCambioProf: true } } } } },
    });
    let ml = 0;
    let valor = 0;
    for (const l of lotes) {
      ml += l.cantidadDisponible;
      valor += l.cantidadDisponible * Number(l.costoUnitario) * Number(l.proformaDetalle.proforma.tipoCambioProf ?? 0);
    }
    return { mlDisponibles: ml, costoMlBs: ml > 0 ? Math.round((valor / ml) * 10000) / 10000 : null };
  }

  /** ml que hay ahora en cada variante Decants y almacén. */
  async resumen(query: { almacenId?: string; search?: string }) {
    const filas = await this.prisma.stock.findMany({
      where: {
        almacenId: query.almacenId,
        variante: { unidad: UnidadVariante.ML },
        cantidadFisica: { gt: 0 },
      },
      include: { variante: { select: varianteSelect }, almacen: { select: { id: true, nombre: true } } },
    });
    const items = filas
      .map((f) => ({
        varianteId: f.varianteId,
        almacenId: f.almacenId,
        variante: f.variante,
        almacen: f.almacen,
        mlFisicos: f.cantidadFisica,
        mlReservados: f.cantidadReservada,
        mlDisponibles: f.cantidadFisica - f.cantidadReservada,
      }))
      .filter((f) => !query.search?.trim() || f.variante.product.name.toLowerCase().includes(query.search.trim().toLowerCase()))
      .sort((a, b) => a.variante.product.name.localeCompare(b.variante.product.name) || a.almacen.nombre.localeCompare(b.almacen.nombre));
    return { items, totalMl: items.reduce((n, i) => n + i.mlFisicos, 0) };
  }

  async movimientos(query: { page?: string; pageSize?: string; almacenId?: string; tipo?: string }) {
    const { page, pageSize, skip, take } = getPagination({ page: query.page ?? "1", pageSize: query.pageSize ?? "20" });
    const tipo = query.tipo === "CONVERSION" || query.tipo === "BAJA" ? query.tipo : undefined;
    const where: Prisma.MovimientoDecantWhereInput = { almacenId: query.almacenId, tipo };
    const [items, total] = await Promise.all([
      this.prisma.movimientoDecant.findMany({ where, skip, take, orderBy: { fecha: "desc" }, include: movimientoInclude }),
      this.prisma.movimientoDecant.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** Saca frascos del stock disponible y suma sus ml a la variante Decants, con el costo real de cada lote (costo / ml). */
  async convertir(dto: ConvertirDecantDto, usuarioId: string) {
    const almacen = await this.prisma.almacen.findUnique({ where: { id: dto.almacenId } });
    if (!almacen || !almacen.activo) throw new BadRequestException("almacenId inválido o inactivo.");
    const [origen, destino] = await Promise.all([
      this.prisma.productVariant.findUnique({ where: { id: dto.varianteOrigenId }, select: { id: true, productId: true, unidad: true } }),
      this.prisma.productVariant.findUnique({ where: { id: dto.varianteId }, select: { id: true, productId: true, unidad: true } }),
    ]);
    if (!origen) throw new BadRequestException(`varianteOrigenId inválido: ${dto.varianteOrigenId}`);
    if (!destino) throw new BadRequestException(`varianteId inválido: ${dto.varianteId}`);
    if (origen.unidad !== UnidadVariante.PZA) throw new BadRequestException("Solo se pueden convertir frascos (variantes en piezas).");
    if (destino.unidad !== UnidadVariante.ML) throw new BadRequestException("La variante destino debe ser de unidad ML (Decants).");
    if (origen.productId !== destino.productId) throw new BadRequestException("Los frascos y los decants deben ser del mismo producto.");

    const cantidadFrascos = dto.lotes.reduce((n, l) => n + l.cantidad, 0);
    const cantidadMl = cantidadFrascos * dto.mlPorFrasco;
    try {
      const id = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          const stockPorPar = await lockStockRows(tx, [
            { varianteId: dto.varianteOrigenId, almacenId: dto.almacenId },
            { varianteId: dto.varianteId, almacenId: dto.almacenId },
          ]);
          const stock = stockPorPar.get(stockKey(dto.varianteOrigenId, dto.almacenId))!;
          const disponible = stock.cantidadFisica - stock.cantidadReservada;
          if (cantidadFrascos > disponible) {
            throw new BadRequestException(`No hay suficiente stock disponible: pedís ${cantidadFrascos}, hay ${disponible}.`);
          }

          const lotesMov: { loteOrigenId: string; loteDestinoId: string; cantidad: number; costoUnitario: Prisma.Decimal }[] = [];
          let costoTotal = 0;
          for (const entrada of dto.lotes) {
            const lote = await tx.loteCompra.findUnique({ where: { id: entrada.loteCompraId } });
            if (!lote || lote.varianteId !== dto.varianteOrigenId || lote.almacenId !== dto.almacenId) {
              throw new BadRequestException(`loteCompraId inválido para esta variante/almacén: ${entrada.loteCompraId}`);
            }
            const resultado = await tx.loteCompra.updateMany({
              where: { id: entrada.loteCompraId, cantidadDisponible: { gte: entrada.cantidad } },
              data: { cantidadDisponible: { decrement: entrada.cantidad } },
            });
            if (resultado.count === 0) {
              throw new ConflictException(`El lote ${entrada.loteCompraId} ya no tiene ${entrada.cantidad} unidad(es) disponibles.`);
            }
            const costoPorMl = new Prisma.Decimal(lote.costoUnitario).div(dto.mlPorFrasco).toDecimalPlaces(4);
            const loteMl = await tx.loteCompra.create({
              data: {
                varianteId: dto.varianteId,
                almacenId: dto.almacenId,
                proformaDetalleId: lote.proformaDetalleId,
                costoUnitario: costoPorMl,
                cantidadInicial: entrada.cantidad * dto.mlPorFrasco,
                cantidadDisponible: entrada.cantidad * dto.mlPorFrasco,
              },
            });
            lotesMov.push({ loteOrigenId: lote.id, loteDestinoId: loteMl.id, cantidad: entrada.cantidad, costoUnitario: lote.costoUnitario });
            costoTotal += Number(lote.costoUnitario) * entrada.cantidad;
          }

          const mov = await tx.movimientoDecant.create({
            data: {
              tipo: TipoMovimientoDecant.CONVERSION,
              varianteId: dto.varianteId,
              varianteOrigenId: dto.varianteOrigenId,
              almacenId: dto.almacenId,
              cantidadFrascos,
              mlPorFrasco: dto.mlPorFrasco,
              cantidadMl,
              costoTotal: redondear2(costoTotal),
              nota: dto.nota?.trim() || null,
              creadoPorId: usuarioId,
              lotes: { create: lotesMov },
            },
          });
          await tx.stock.update({
            where: { varianteId_almacenId: { varianteId: dto.varianteOrigenId, almacenId: dto.almacenId } },
            data: { cantidadFisica: { decrement: cantidadFrascos } },
          });
          await tx.stock.update({
            where: { varianteId_almacenId: { varianteId: dto.varianteId, almacenId: dto.almacenId } },
            data: { cantidadFisica: { increment: cantidadMl } },
          });
          return mov.id;
        },
        { timeout: 15000, maxWait: 5000 },
      );
      return await this.prisma.movimientoDecant.findUniqueOrThrow({ where: { id }, include: movimientoInclude });
    } catch (error) {
      rethrowPrismaError(error, "Decant");
    }
  }

  /** ml perdidos (derrame, merma): bajan el stock de la variante Decants, consumiendo los lotes de ml más antiguos primero. */
  async baja(dto: BajaMlDto, usuarioId: string) {
    const variante = await this.prisma.productVariant.findUnique({ where: { id: dto.varianteId }, select: { unidad: true } });
    if (!variante) throw new BadRequestException(`varianteId inválido: ${dto.varianteId}`);
    if (variante.unidad !== UnidadVariante.ML) throw new BadRequestException("Solo se pueden dar de baja ml de una variante Decants (unidad ML).");
    try {
      const id = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          const stockPorPar = await lockStockRows(tx, [{ varianteId: dto.varianteId, almacenId: dto.almacenId }]);
          const stock = stockPorPar.get(stockKey(dto.varianteId, dto.almacenId))!;
          const disponible = stock.cantidadFisica - stock.cantidadReservada;
          if (dto.cantidadMl > disponible) {
            throw new BadRequestException(`No hay suficientes ml disponibles: pedís ${dto.cantidadMl}, hay ${disponible}.`);
          }

          const lotes = await tx.loteCompra.findMany({
            where: { varianteId: dto.varianteId, almacenId: dto.almacenId, cantidadDisponible: { gt: 0 } },
            orderBy: [{ fecha: "asc" }, { id: "asc" }],
          });
          let faltan = dto.cantidadMl;
          let costoTotal = 0;
          const lotesMov: { loteOrigenId: string; cantidad: number; costoUnitario: Prisma.Decimal }[] = [];
          for (const lote of lotes) {
            if (faltan <= 0) break;
            const toma = Math.min(faltan, lote.cantidadDisponible);
            const resultado = await tx.loteCompra.updateMany({
              where: { id: lote.id, cantidadDisponible: { gte: toma } },
              data: { cantidadDisponible: { decrement: toma } },
            });
            if (resultado.count === 0) throw new ConflictException("Los lotes cambiaron mientras se hacía la baja. Intentá de nuevo.");
            lotesMov.push({ loteOrigenId: lote.id, cantidad: toma, costoUnitario: lote.costoUnitario });
            costoTotal += Number(lote.costoUnitario) * toma;
            faltan -= toma;
          }
          if (faltan > 0) throw new BadRequestException("Los lotes no cubren los ml pedidos.");

          const mov = await tx.movimientoDecant.create({
            data: {
              tipo: TipoMovimientoDecant.BAJA,
              varianteId: dto.varianteId,
              almacenId: dto.almacenId,
              cantidadMl: dto.cantidadMl,
              costoTotal: redondear2(costoTotal),
              nota: dto.nota?.trim() || null,
              creadoPorId: usuarioId,
              lotes: { create: lotesMov },
            },
          });
          await tx.stock.update({
            where: { varianteId_almacenId: { varianteId: dto.varianteId, almacenId: dto.almacenId } },
            data: { cantidadFisica: { decrement: dto.cantidadMl } },
          });
          return mov.id;
        },
        { timeout: 15000, maxWait: 5000 },
      );
      return await this.prisma.movimientoDecant.findUniqueOrThrow({ where: { id }, include: movimientoInclude });
    } catch (error) {
      rethrowPrismaError(error, "Decant");
    }
  }

  /** Deshace una conversión: devuelve los frascos al stock y quita los ml. Solo si esos ml siguen intactos (sin ventas ni bajas). */
  async deshacer(id: string) {
    const mov = await this.prisma.movimientoDecant.findUnique({ where: { id }, include: { lotes: true } });
    if (!mov) throw new NotFoundException("Movimiento no encontrado.");
    if (mov.tipo !== TipoMovimientoDecant.CONVERSION) throw new BadRequestException("Solo se pueden deshacer conversiones.");
    if (mov.revertidoAt) throw new BadRequestException("Esta conversión ya se deshizo.");
    if (!mov.varianteOrigenId) throw new BadRequestException("La conversión no tiene variante de origen.");
    const varianteOrigenId = mov.varianteOrigenId;
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          const stockPorPar = await lockStockRows(tx, [
            { varianteId: varianteOrigenId, almacenId: mov.almacenId },
            { varianteId: mov.varianteId, almacenId: mov.almacenId },
          ]);
          const stockMl = stockPorPar.get(stockKey(mov.varianteId, mov.almacenId))!;
          if (stockMl.cantidadFisica - stockMl.cantidadReservada < mov.cantidadMl) {
            throw new ConflictException("Esos ml ya no están disponibles (hay ventas reservadas o ya se vendieron): no se puede deshacer.");
          }

          for (const l of mov.lotes) {
            if (!l.loteDestinoId) continue;
            const loteMl = await tx.loteCompra.findUniqueOrThrow({ where: { id: l.loteDestinoId } });
            const consumos = await tx.loteCompraConsumo.count({ where: { loteCompraId: loteMl.id } });
            if (consumos > 0 || loteMl.cantidadDisponible !== loteMl.cantidadInicial) {
              throw new ConflictException("Parte de esos ml ya se vendió, se dio de baja o se movió: no se puede deshacer.");
            }
            await tx.loteCompra.update({ where: { id: loteMl.id }, data: { cantidadDisponible: 0 } });
            await tx.loteCompra.update({ where: { id: l.loteOrigenId }, data: { cantidadDisponible: { increment: l.cantidad } } });
          }
          await tx.stock.update({
            where: { varianteId_almacenId: { varianteId: varianteOrigenId, almacenId: mov.almacenId } },
            data: { cantidadFisica: { increment: mov.cantidadFrascos } },
          });
          await tx.stock.update({
            where: { varianteId_almacenId: { varianteId: mov.varianteId, almacenId: mov.almacenId } },
            data: { cantidadFisica: { decrement: mov.cantidadMl } },
          });
          await tx.movimientoDecant.update({ where: { id }, data: { revertidoAt: new Date() } });
        },
        { timeout: 15000, maxWait: 5000 },
      );
      return await this.prisma.movimientoDecant.findUniqueOrThrow({ where: { id }, include: movimientoInclude });
    } catch (error) {
      rethrowPrismaError(error, "Decant");
    }
  }
}
