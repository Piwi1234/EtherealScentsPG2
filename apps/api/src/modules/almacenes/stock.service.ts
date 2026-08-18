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
      unidad: true,
      // attributeValues+variantOptionValues: atributos marcados mostrarEnProforma (NONE y MULTI_VALUE
      // respectivamente). options: qué distingue a ESTA variante puntual (ej. "Tamaño: 50 ML") —
      // juntos arman la etiqueta que reemplaza al código de producto en la tabla de Existencias.
      product: {
        select: {
          id: true,
          name: true,
          productCode: true,
          imageUrl: true,
          brand: { select: { id: true, name: true } },
          attributeValues: { include: { attribute: true, option: true } },
          variantOptionValues: { include: { attribute: true } },
        },
      },
      options: { include: { optionValue: { include: { attribute: true } } } },
    },
  },
  almacen: { select: { id: true, nombre: true } },
} as const;

const loteInclude = {
  variante: {
    select: { id: true, variantCode: true, unidad: true, product: { select: { id: true, name: true, productCode: true } } },
  },
  almacen: { select: { id: true, nombre: true } },
  // Para poder valorar el costo unitario en Bs con el tipo de cambio propio de la compra que trajo
  // este lote (no el tipo de cambio del sistema, que puede haber cambiado después).
  proformaDetalle: { select: { proforma: { select: { tipoCambioProf: true } } } },
} as const;

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /** El filtro de categoría del frontend solo ofrece categorías padre — acá se expande a ese padre
   * más todas sus subcategorías (a cualquier profundidad), porque los productos se categorizan en la
   * subcategoría, no en el padre directamente (mismo criterio que en Seguimiento). */
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

  async findAll(query: {
    page?: string;
    pageSize?: string;
    almacenId?: string;
    search?: string;
    categoryId?: string;
    brandId?: string;
  }) {
    const { page, pageSize, skip, take } = getPagination({
      page: query.page ?? "1",
      pageSize: query.pageSize ?? "20",
    });

    const categoryIds = query.categoryId ? await this.collectCategoryIds(query.categoryId) : undefined;

    const where: Prisma.StockWhereInput = {
      almacenId: query.almacenId,
      cantidadFisica: { gt: 0 },
      variante: {
        product: {
          categoryId: categoryIds ? { in: categoryIds } : undefined,
          brandId: query.brandId,
        },
        ...(query.search
          ? {
              OR: [
                { variantCode: { contains: query.search, mode: "insensitive" } },
                { product: { name: { contains: query.search, mode: "insensitive" } } },
                { product: { productCode: { contains: query.search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
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

  async findLotes(query: {
    page?: string;
    pageSize?: string;
    varianteId?: string;
    almacenId?: string;
    estado?: "disponible" | "agotado";
  }) {
    const { page, pageSize, skip, take } = getPagination({
      page: query.page ?? "1",
      pageSize: query.pageSize ?? "20",
    });

    const where: Prisma.LoteCompraWhereInput = {
      varianteId: query.varianteId,
      almacenId: query.almacenId,
      cantidadDisponible: query.estado === "disponible" ? { gt: 0 } : query.estado === "agotado" ? 0 : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.loteCompra.findMany({ where, skip, take, orderBy: { fecha: "desc" }, include: loteInclude }),
      this.prisma.loteCompra.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
