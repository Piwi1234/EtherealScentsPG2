import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { lockStockRows, stockKey } from "../proformas/stock-lock.util";
import { CreateTraspasoAlmacenDto } from "./dto/create-traspaso-almacen.dto";

const traspasoInclude = {
  variante: { select: { id: true, variantCode: true, unidad: true, product: { select: { id: true, name: true, productCode: true } } } },
  almacenOrigen: { select: { id: true, nombre: true } },
  almacenDestino: { select: { id: true, nombre: true } },
  creadoPor: { select: { id: true, nombre: true } },
  lotes: true,
} satisfies Prisma.TraspasoAlmacenInclude;

/**
 * Traspaso de stock físico entre almacenes — instantáneo e inmutable (ver doc-comment de
 * TraspasoAlmacen en schema.prisma). A diferencia de un traspaso de Contabilidad, este mueve
 * también los LoteCompra usados (no solo el número agregado de Stock), para que una venta futura
 * desde el destino siga pudiendo elegir lotes reales con su costo real — mismo mecanismo de reparto
 * manual de lotes que ya usa completarVenta en proforma-completion.service.ts.
 */
@Injectable()
export class TraspasoAlmacenService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { page?: string; pageSize?: string; varianteId?: string; almacenId?: string }) {
    const { page, pageSize, skip, take } = getPagination({ page: query.page ?? "1", pageSize: query.pageSize ?? "20" });

    const where: Prisma.TraspasoAlmacenWhereInput = {
      varianteId: query.varianteId,
      ...(query.almacenId
        ? { OR: [{ almacenOrigenId: query.almacenId }, { almacenDestinoId: query.almacenId }] }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.traspasoAlmacen.findMany({ where, skip, take, orderBy: { fecha: "desc" }, include: traspasoInclude }),
      this.prisma.traspasoAlmacen.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async create(dto: CreateTraspasoAlmacenDto, usuarioId: string) {
    if (dto.almacenOrigenId === dto.almacenDestinoId) {
      throw new BadRequestException("El almacén de origen y destino no pueden ser el mismo.");
    }

    const [origen, destino, variante] = await Promise.all([
      this.prisma.almacen.findUnique({ where: { id: dto.almacenOrigenId } }),
      this.prisma.almacen.findUnique({ where: { id: dto.almacenDestinoId } }),
      this.prisma.productVariant.findUnique({ where: { id: dto.varianteId } }),
    ]);
    if (!origen || !origen.activo) throw new BadRequestException("almacenOrigenId inválido o inactivo.");
    if (!destino || !destino.activo) throw new BadRequestException("almacenDestinoId inválido o inactivo.");
    if (!variante) throw new BadRequestException(`varianteId inválido: ${dto.varianteId}`);

    const cantidadTotal = dto.lotes.reduce((sum, l) => sum + l.cantidad, 0);

    try {
      const id = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;

          const stockPorPar = await lockStockRows(tx, [
            { varianteId: dto.varianteId, almacenId: dto.almacenOrigenId },
            { varianteId: dto.varianteId, almacenId: dto.almacenDestinoId },
          ]);
          const stockOrigen = stockPorPar.get(stockKey(dto.varianteId, dto.almacenOrigenId))!;
          const disponible = stockOrigen.cantidadFisica - stockOrigen.cantidadReservada;
          if (cantidadTotal > disponible) {
            throw new BadRequestException(`No hay suficiente stock disponible: pedís ${cantidadTotal}, hay ${disponible}.`);
          }

          const traspaso = await tx.traspasoAlmacen.create({
            data: {
              varianteId: dto.varianteId,
              almacenOrigenId: dto.almacenOrigenId,
              almacenDestinoId: dto.almacenDestinoId,
              cantidad: cantidadTotal,
              nota: dto.nota,
              creadoPorId: usuarioId,
            },
          });

          for (const entrada of dto.lotes) {
            const loteOrigen = await tx.loteCompra.findUnique({ where: { id: entrada.loteCompraId } });
            if (!loteOrigen || loteOrigen.varianteId !== dto.varianteId || loteOrigen.almacenId !== dto.almacenOrigenId) {
              throw new BadRequestException(`loteCompraId inválido para esta variante/almacén: ${entrada.loteCompraId}`);
            }

            const resultado = await tx.loteCompra.updateMany({
              where: { id: entrada.loteCompraId, cantidadDisponible: { gte: entrada.cantidad } },
              data: { cantidadDisponible: { decrement: entrada.cantidad } },
            });
            if (resultado.count === 0) {
              throw new ConflictException(`El lote ${entrada.loteCompraId} ya no tiene ${entrada.cantidad} unidad(es) disponibles.`);
            }

            const loteDestino = await tx.loteCompra.create({
              data: {
                varianteId: dto.varianteId,
                almacenId: dto.almacenDestinoId,
                proformaDetalleId: loteOrigen.proformaDetalleId,
                costoUnitario: loteOrigen.costoUnitario,
                cantidadInicial: entrada.cantidad,
                cantidadDisponible: entrada.cantidad,
              },
            });

            await tx.traspasoAlmacenLote.create({
              data: {
                traspasoId: traspaso.id,
                loteOrigenId: loteOrigen.id,
                loteDestinoId: loteDestino.id,
                cantidad: entrada.cantidad,
              },
            });
          }

          await tx.stock.update({
            where: { varianteId_almacenId: { varianteId: dto.varianteId, almacenId: dto.almacenOrigenId } },
            data: { cantidadFisica: { decrement: cantidadTotal } },
          });
          await tx.stock.update({
            where: { varianteId_almacenId: { varianteId: dto.varianteId, almacenId: dto.almacenDestinoId } },
            data: { cantidadFisica: { increment: cantidadTotal } },
          });

          return traspaso.id;
        },
        { timeout: 15000, maxWait: 5000 },
      );

      return await this.prisma.traspasoAlmacen.findUniqueOrThrow({ where: { id }, include: traspasoInclude });
    } catch (error) {
      rethrowPrismaError(error, "Traspaso de almacén");
    }
  }
}
