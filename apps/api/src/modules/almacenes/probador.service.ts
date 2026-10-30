import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { Prisma, TipoMovimientoProbador } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { normalizarBusqueda } from "../../common/busqueda";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { lockStockRows, stockKey } from "../proformas/stock-lock.util";
import { BajaProbadorDto, ConvertirProbadorDto } from "./dto/probador.dto";

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
  almacen: { select: { id: true, nombre: true } },
  creadoPor: { select: { id: true, nombre: true } },
} satisfies Prisma.MovimientoProbadorInclude;

/**
 * Probadores: piezas que salen del stock vendible sin venta ni ganancia (CONVERSION) y las que se
 * agotan o se pierden (BAJA). Solo control interno: no toca Contabilidad. Ver MovimientoProbador en schema.prisma.
 */
@Injectable()
export class ProbadorService {
  constructor(private readonly prisma: PrismaService) {}

  private async collectCategoryIds(rootId: string): Promise<string[]> {
    const ids = [rootId];
    let frontier = [rootId];
    while (frontier.length > 0) {
      const children = await this.prisma.category.findMany({ where: { parentId: { in: frontier } }, select: { id: true } });
      if (children.length === 0) break;
      frontier = children.map((c) => c.id);
      ids.push(...frontier);
    }
    return ids;
  }

  /** Probadores que hay ahora por variante y almacén: convertidos menos dados de baja. */
  async resumen(query: { almacenId?: string; categoryId?: string; brandId?: string; search?: string; incluirAgotados?: string }) {
    const categoryIds = query.categoryId ? await this.collectCategoryIds(query.categoryId) : undefined;
    const search = query.search?.trim();
    const where: Prisma.MovimientoProbadorWhereInput = {
      almacenId: query.almacenId,
      variante: {
        product: {
          categoryId: categoryIds ? { in: categoryIds } : undefined,
          brandId: query.brandId,
          ...(search
            ? { OR: [{ nameSearch: { contains: normalizarBusqueda(search) } }, { brand: { nameSearch: { contains: normalizarBusqueda(search) } } }] }
            : {}),
        },
      },
    };
    const grupos = await this.prisma.movimientoProbador.groupBy({
      by: ["varianteId", "almacenId", "tipo"],
      where,
      _sum: { cantidad: true, costoTotal: true },
      _max: { fecha: true },
    });

    const filas = new Map<string, { varianteId: string; almacenId: string; convertidos: number; bajas: number; costoConvertido: number; ultimo: Date | null }>();
    for (const g of grupos) {
      const key = stockKey(g.varianteId, g.almacenId);
      const fila = filas.get(key) ?? { varianteId: g.varianteId, almacenId: g.almacenId, convertidos: 0, bajas: 0, costoConvertido: 0, ultimo: null };
      const cant = g._sum.cantidad ?? 0;
      if (g.tipo === TipoMovimientoProbador.CONVERSION) {
        fila.convertidos += cant;
        fila.costoConvertido += Number(g._sum.costoTotal ?? 0);
      } else {
        fila.bajas += cant;
      }
      if (g._max.fecha && (!fila.ultimo || g._max.fecha > fila.ultimo)) fila.ultimo = g._max.fecha;
      filas.set(key, fila);
    }

    const todas = [...filas.values()].filter((f) => query.incluirAgotados === "true" || f.convertidos - f.bajas > 0);
    const [variantes, almacenes] = await Promise.all([
      this.prisma.productVariant.findMany({ where: { id: { in: todas.map((f) => f.varianteId) } }, select: varianteSelect }),
      this.prisma.almacen.findMany({ where: { id: { in: todas.map((f) => f.almacenId) } }, select: { id: true, nombre: true } }),
    ]);
    const varianteById = new Map(variantes.map((v) => [v.id, v]));
    const almacenById = new Map(almacenes.map((a) => [a.id, a]));

    const items = todas
      .map((f) => ({
        varianteId: f.varianteId,
        almacenId: f.almacenId,
        variante: varianteById.get(f.varianteId)!,
        almacen: almacenById.get(f.almacenId)!,
        convertidos: f.convertidos,
        bajas: f.bajas,
        saldo: f.convertidos - f.bajas,
        costoConvertido: Math.round(f.costoConvertido * 100) / 100,
        ultimoMovimiento: f.ultimo,
      }))
      .sort((a, b) => a.variante.product.name.localeCompare(b.variante.product.name) || a.almacen.nombre.localeCompare(b.almacen.nombre));

    return { items, totalPiezas: items.reduce((n, i) => n + i.saldo, 0) };
  }

  async movimientos(query: { page?: string; pageSize?: string; varianteId?: string; almacenId?: string; tipo?: string }) {
    const { page, pageSize, skip, take } = getPagination({ page: query.page ?? "1", pageSize: query.pageSize ?? "20" });
    const tipo = query.tipo === "CONVERSION" || query.tipo === "BAJA" ? query.tipo : undefined;
    const where: Prisma.MovimientoProbadorWhereInput = { varianteId: query.varianteId, almacenId: query.almacenId, tipo };
    const [items, total] = await Promise.all([
      this.prisma.movimientoProbador.findMany({ where, skip, take, orderBy: { fecha: "desc" }, include: movimientoInclude }),
      this.prisma.movimientoProbador.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** Saca piezas del stock disponible y las deja como probadores, guardando el costo real de los lotes usados. */
  async convertir(dto: ConvertirProbadorDto, usuarioId: string) {
    const almacen = await this.prisma.almacen.findUnique({ where: { id: dto.almacenId } });
    if (!almacen || !almacen.activo) throw new BadRequestException("almacenId inválido o inactivo.");
    const variante = await this.prisma.productVariant.findUnique({ where: { id: dto.varianteId }, select: { id: true } });
    if (!variante) throw new BadRequestException(`varianteId inválido: ${dto.varianteId}`);

    const cantidadTotal = dto.lotes.reduce((n, l) => n + l.cantidad, 0);
    try {
      const id = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          const stockPorPar = await lockStockRows(tx, [{ varianteId: dto.varianteId, almacenId: dto.almacenId }]);
          const stock = stockPorPar.get(stockKey(dto.varianteId, dto.almacenId))!;
          const disponible = stock.cantidadFisica - stock.cantidadReservada;
          if (cantidadTotal > disponible) {
            throw new BadRequestException(`No hay suficiente stock disponible: pedís ${cantidadTotal}, hay ${disponible}.`);
          }

          const lotesUsados: { loteCompraId: string; cantidad: number; costoUnitario: Prisma.Decimal }[] = [];
          for (const entrada of dto.lotes) {
            const lote = await tx.loteCompra.findUnique({ where: { id: entrada.loteCompraId } });
            if (!lote || lote.varianteId !== dto.varianteId || lote.almacenId !== dto.almacenId) {
              throw new BadRequestException(`loteCompraId inválido para esta variante/almacén: ${entrada.loteCompraId}`);
            }
            const resultado = await tx.loteCompra.updateMany({
              where: { id: entrada.loteCompraId, cantidadDisponible: { gte: entrada.cantidad } },
              data: { cantidadDisponible: { decrement: entrada.cantidad } },
            });
            if (resultado.count === 0) {
              throw new ConflictException(`El lote ${entrada.loteCompraId} ya no tiene ${entrada.cantidad} unidad(es) disponibles.`);
            }
            lotesUsados.push({ loteCompraId: lote.id, cantidad: entrada.cantidad, costoUnitario: lote.costoUnitario });
          }

          const costoTotal = lotesUsados.reduce((n, l) => n + Number(l.costoUnitario) * l.cantidad, 0);
          const mov = await tx.movimientoProbador.create({
            data: {
              tipo: TipoMovimientoProbador.CONVERSION,
              varianteId: dto.varianteId,
              almacenId: dto.almacenId,
              cantidad: cantidadTotal,
              costoTotal: Math.round(costoTotal * 100) / 100,
              nota: dto.nota?.trim() || null,
              creadoPorId: usuarioId,
              lotes: { create: lotesUsados },
            },
          });
          await tx.stock.update({
            where: { varianteId_almacenId: { varianteId: dto.varianteId, almacenId: dto.almacenId } },
            data: { cantidadFisica: { decrement: cantidadTotal } },
          });
          return mov.id;
        },
        { timeout: 15000, maxWait: 5000 },
      );
      return await this.prisma.movimientoProbador.findUniqueOrThrow({ where: { id }, include: movimientoInclude });
    } catch (error) {
      rethrowPrismaError(error, "Probador");
    }
  }

  /** Probadores que ya no están (se agotaron, se perdieron, se rompieron): bajan el saldo, sin tocar el stock. */
  async baja(dto: BajaProbadorDto, usuarioId: string) {
    try {
      const id = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          // Bloquear la fila de stock del par serializa conversiones y bajas simultáneas del mismo producto.
          await lockStockRows(tx, [{ varianteId: dto.varianteId, almacenId: dto.almacenId }]);
          const agg = await tx.movimientoProbador.groupBy({
            by: ["tipo"],
            where: { varianteId: dto.varianteId, almacenId: dto.almacenId },
            _sum: { cantidad: true },
          });
          const suma = (t: TipoMovimientoProbador) => agg.find((a) => a.tipo === t)?._sum.cantidad ?? 0;
          const saldo = suma(TipoMovimientoProbador.CONVERSION) - suma(TipoMovimientoProbador.BAJA);
          if (dto.cantidad > saldo) {
            throw new BadRequestException(`Solo hay ${saldo} probador(es) de este producto en el almacén.`);
          }
          const mov = await tx.movimientoProbador.create({
            data: {
              tipo: TipoMovimientoProbador.BAJA,
              varianteId: dto.varianteId,
              almacenId: dto.almacenId,
              cantidad: dto.cantidad,
              nota: dto.nota?.trim() || null,
              creadoPorId: usuarioId,
            },
          });
          return mov.id;
        },
        { timeout: 15000, maxWait: 5000 },
      );
      return await this.prisma.movimientoProbador.findUniqueOrThrow({ where: { id }, include: movimientoInclude });
    } catch (error) {
      rethrowPrismaError(error, "Probador");
    }
  }
}
