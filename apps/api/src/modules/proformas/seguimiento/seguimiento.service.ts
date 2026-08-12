import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { OrigenAsignacion, Prisma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../../common/prisma.service";
import { QuerySeguimientoDto } from "./dto/query-seguimiento.dto";
import { UpdateEstadoSeguimientoDto } from "./dto/update-estado-seguimiento.dto";

// Mismo shape que ProformaDetalleTable/AgregarProductoBrowser necesitan para mostrar la variante
// (opciones propias + atributos heredados marcados mostrarEnProforma) y para poder filtrar por
// categoría del producto.
const includeLinea = {
  proformaDetalle: {
    select: {
      proforma: { select: { id: true, fecha: true, empresa: { select: { id: true, nombre: true } } } },
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
    },
  },
} satisfies Prisma.ProformaDetalleAsignacionInclude;

/**
 * Todo lo que hoy está a Procura (venta aprobada sin stock suficiente todavía): la vista operativa de
 * "qué falta pedirle al proveedor". Se recalcula en vivo desde ProformaDetalleAsignacion — no es un
 * snapshot, cambia solo cuando una compra resuelve la Procura o se anula la venta que la generaba (ver
 * procura.util.ts). El estado editable acá es Pendiente/Comprado/Enviado.
 */
@Injectable()
export class SeguimientoService {
  constructor(private readonly prisma: PrismaService) {}

  /** El filtro de categoría del frontend solo ofrece categorías padre — acá se expande a ese padre
   * más todas sus subcategorías (a cualquier profundidad), porque los productos se categorizan en la
   * subcategoría, no en el padre directamente. */
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

  async findPendientes(query: QuerySeguimientoDto) {
    const categoryIds = query.categoryId ? await this.collectCategoryIds(query.categoryId) : undefined;

    const where: Prisma.ProformaDetalleAsignacionWhereInput = {
      origen: OrigenAsignacion.PROCURA,
      cantidad: { gt: 0 },
      estadoSeguimiento: query.estado,
      proformaDetalle: {
        proforma: query.empresaId ? { empresaId: query.empresaId } : undefined,
        variante: categoryIds ? { product: { categoryId: { in: categoryIds } } } : undefined,
      },
    };

    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });

    const [items, total] = await Promise.all([
      this.prisma.proformaDetalleAsignacion.findMany({
        where,
        // Por producto, y dentro de cada producto de la más antigua a la más nueva.
        orderBy: [
          { proformaDetalle: { variante: { product: { name: "asc" } } } },
          { proformaDetalle: { proforma: { fecha: "asc" } } },
        ],
        include: includeLinea,
        skip,
        take,
      }),
      this.prisma.proformaDetalleAsignacion.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async updateEstado(id: string, dto: UpdateEstadoSeguimientoDto) {
    const asignacion = await this.prisma.proformaDetalleAsignacion.findUnique({ where: { id } });
    if (!asignacion) {
      throw new NotFoundException("Línea de Procura no encontrada.");
    }
    if (asignacion.origen !== OrigenAsignacion.PROCURA) {
      throw new BadRequestException("El seguimiento solo aplica a líneas a Procura.");
    }

    return this.prisma.proformaDetalleAsignacion.update({
      where: { id },
      data: { estadoSeguimiento: dto.estado },
      include: includeLinea,
    });
  }
}
