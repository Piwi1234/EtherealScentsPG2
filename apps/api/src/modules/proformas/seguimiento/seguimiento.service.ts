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

  async findPendientes(query: QuerySeguimientoDto) {
    const where: Prisma.ProformaDetalleAsignacionWhereInput = {
      origen: OrigenAsignacion.PROCURA,
      cantidad: { gt: 0 },
      estadoSeguimiento: query.estado,
      proformaDetalle: {
        proforma: query.empresaId ? { empresaId: query.empresaId } : undefined,
        variante: query.categoryId ? { product: { categoryId: query.categoryId } } : undefined,
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
