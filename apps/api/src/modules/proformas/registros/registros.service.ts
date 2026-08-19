import { Injectable } from "@nestjs/common";
import { EstadoProforma, Prisma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../../common/prisma.service";
import { CategoryService } from "../../../catalog/category/category.service";
import { QueryRegistrosDto } from "./dto/query-registros.dto";

// Solo transacciones reales (ni Borrador todavía, ni Anulada que no llegó a pasar) — mismo criterio
// que ya usa Seguimiento para "líneas con seguimiento habilitado".
const ESTADOS_REGISTRABLES: EstadoProforma[] = [EstadoProforma.APROBADA, EstadoProforma.COMPLETADA];

const registroInclude = {
  proforma: {
    select: {
      id: true,
      codigo: true,
      fecha: true,
      empresa: { select: { id: true, nombre: true } },
      cliente: { select: { id: true, nombre: true } },
      proveedor: { select: { id: true, nombre: true } },
      paisProcedencia: { select: { id: true, nombre: true } },
      tipoCambioProf: true,
    },
  },
  variante: {
    include: {
      product: {
        include: {
          attributeValues: { include: { attribute: true, option: true } },
          variantOptionValues: { include: { attribute: true } },
          brand: true,
        },
      },
      options: { include: { optionValue: { include: { attribute: true } } } },
    },
  },
} satisfies Prisma.ProformaDetalleInclude;

/**
 * Ledger de líneas de proforma (COMPRA o VENTA) para el módulo de Registros: cada fila es un
 * producto de una proforma, filtrable por fecha/categoría/marca/producto. Se recalcula en vivo desde
 * ProformaDetalle — no es una tabla propia.
 */
@Injectable()
export class RegistrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoryService,
  ) {}

  async findAll(query: QueryRegistrosDto) {
    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });

    const categoryIds = query.categoryId ? await this.categories.getDescendantIds(query.categoryId) : undefined;

    const hasta = query.fechaHasta ? new Date(query.fechaHasta) : undefined;
    if (hasta) hasta.setUTCHours(23, 59, 59, 999);

    const where: Prisma.ProformaDetalleWhereInput = {
      proforma: {
        tipo: query.tipo,
        codigo: query.codigo ? query.codigo.trim().toUpperCase() : undefined,
        clienteId: query.clienteId,
        proveedorId: query.proveedorId,
        estado: { in: ESTADOS_REGISTRABLES },
        fecha: {
          gte: query.fechaDesde ? new Date(query.fechaDesde) : undefined,
          lte: hasta,
        },
      },
      variante: {
        productId: query.productId,
        product: {
          categoryId: categoryIds ? { in: categoryIds } : undefined,
          brandId: query.brandId,
        },
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.proformaDetalle.findMany({
        where,
        skip,
        take,
        orderBy: { proforma: { fecha: "desc" } },
        include: registroInclude,
      }),
      this.prisma.proformaDetalle.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
