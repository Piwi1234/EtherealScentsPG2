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
      estado: true,
      fecha: true,
      empresa: { select: { id: true, nombre: true } },
      cliente: { select: { id: true, nombre: true } },
      tipoCambioProf: true,
    },
  },
  // Por línea, no por proforma entera (ver ProformaDetalle.proveedorId) — null en líneas de venta.
  // Incluye el país del proveedor: el país de origen ya no se guarda en la proforma/línea, se
  // consulta en vivo desde acá.
  proveedor: { select: { id: true, nombre: true, paisProcedencia: { select: { id: true, nombre: true } } } },
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

    // Mismo criterio que la búsqueda de Productos: cada palabra exige su propio match (nombre, código
    // o marca) y todas las palabras van en AND, así "waka double" encuentra la marca y el producto.
    const searchWords = query.search?.trim() ? query.search.trim().split(/\s+/).filter(Boolean) : [];

    const where: Prisma.ProformaDetalleWhereInput = {
      proveedorId: query.proveedorId,
      proforma: {
        tipo: query.tipo,
        codigo: query.codigo ? query.codigo.trim().toUpperCase() : undefined,
        clienteId: query.clienteId,
        estado: query.estado ? EstadoProforma[query.estado] : { in: ESTADOS_REGISTRABLES },
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
          ...(searchWords.length > 0
            ? {
                AND: searchWords.map((word) => ({
                  OR: [
                    { name: { contains: word, mode: "insensitive" as const } },
                    { productCode: { contains: word, mode: "insensitive" as const } },
                    { brand: { name: { contains: word, mode: "insensitive" as const } } },
                  ],
                })),
              }
            : {}),
        },
      },
    };

    const [items, total, todas] = await Promise.all([
      this.prisma.proformaDetalle.findMany({
        where,
        skip,
        take,
        // Las líneas de una misma proforma quedan contiguas (la pantalla las agrupa bajo su encabezado).
        orderBy: [{ proforma: { fecha: "desc" } }, { proformaId: "asc" }, { createdAt: "asc" }],
        include: registroInclude,
      }),
      this.prisma.proformaDetalle.count({ where }),
      // Resumen de TODO el filtro (no solo de la página): total en Bs, piezas y proformas distintas.
      this.prisma.proformaDetalle.findMany({
        where,
        select: {
          cantidad: true,
          subtotal: true,
          proformaId: true,
          presentacionVenta: { select: { cantidadMl: true } },
          variante: { select: { unidad: true } },
          proforma: { select: { tipoCambioProf: true } },
        },
      }),
    ]);

    // VENTA: el subtotal ya está en Bs. COMPRA: está en la moneda de la compra y se pasa a Bs con el
    // tipo de cambio propio de cada proforma (sin tipo de cambio no se puede convertir y no suma).
    let totalBs = 0;
    let piezas = 0;
    const proformas = new Set<string>();
    for (const l of todas) {
      proformas.add(l.proformaId);
      const subtotal = Number(l.subtotal);
      if (query.tipo === "VENTA") totalBs += subtotal;
      else if (l.proforma.tipoCambioProf) totalBs += subtotal * Number(l.proforma.tipoCambioProf);
      // Una venta en ml cuenta frascos (presentaciones); una compra en ml, una unidad por línea.
      if (l.presentacionVenta?.cantidadMl) piezas += Math.round(l.cantidad / l.presentacionVenta.cantidadMl);
      else if (l.variante.unidad === "ML") piezas += 1;
      else piezas += l.cantidad;
    }
    const resumen = { totalBs: Math.round(totalBs * 100) / 100, piezas, proformas: proformas.size };

    return { items, total, page, pageSize, resumen };
  }
}
