import { Injectable } from "@nestjs/common";
import { Prisma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";

const stockInclude = {
  variante: {
    select: {
      id: true,
      variantCode: true,
      isDefault: true,
      product: { select: { id: true, name: true, productCode: true, imageUrl: true } },
    },
  },
  almacen: { select: { id: true, nombre: true } },
} as const;

const loteInclude = {
  variante: {
    select: { id: true, variantCode: true, product: { select: { id: true, name: true, productCode: true } } },
  },
  almacen: { select: { id: true, nombre: true } },
} as const;

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { page?: string; pageSize?: string; almacenId?: string; search?: string }) {
    const { page, pageSize, skip, take } = getPagination({
      page: query.page ?? "1",
      pageSize: query.pageSize ?? "20",
    });

    const where: Prisma.StockWhereInput = {
      almacenId: query.almacenId,
      cantidadFisica: { gt: 0 },
      ...(query.search
        ? {
            variante: {
              OR: [
                { variantCode: { contains: query.search, mode: "insensitive" } },
                { product: { name: { contains: query.search, mode: "insensitive" } } },
                { product: { productCode: { contains: query.search, mode: "insensitive" } } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.stock.findMany({
        where,
        skip,
        take,
        orderBy: [{ almacen: { nombre: "asc" } }, { variante: { product: { name: "asc" } } }],
        include: stockInclude,
      }),
      this.prisma.stock.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findLotes(query: { page?: string; pageSize?: string; varianteId?: string; almacenId?: string }) {
    const { page, pageSize, skip, take } = getPagination({
      page: query.page ?? "1",
      pageSize: query.pageSize ?? "20",
    });

    const where: Prisma.LoteCompraWhereInput = { varianteId: query.varianteId, almacenId: query.almacenId };

    const [items, total] = await Promise.all([
      this.prisma.loteCompra.findMany({ where, skip, take, orderBy: { fecha: "desc" }, include: loteInclude }),
      this.prisma.loteCompra.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
