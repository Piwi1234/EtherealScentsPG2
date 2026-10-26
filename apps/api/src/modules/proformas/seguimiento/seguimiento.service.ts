import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DestinoCompra, EstadoEnvio, EstadoProforma, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../../common/prisma.service";
import { EstadoPedido, QuerySeguimientoDto } from "./dto/query-seguimiento.dto";
import { UpdateEstadoSeguimientoDto } from "./dto/update-estado-seguimiento.dto";

// Mismo shape que ProformaDetalleTable/AgregarProductoBrowser necesitan para mostrar la variante
// (opciones propias + atributos heredados marcados mostrarEnProforma) y para poder filtrar por
// categoría del producto.
const varianteInclude = {
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
} satisfies { include: Prisma.ProductVariantInclude };

const includeLinea = {
  proformaDetalle: {
    select: {
      proforma: {
        select: {
          id: true,
          codigo: true,
          fecha: true,
          empresa: { select: { id: true, nombre: true } },
          cliente: { select: { id: true, nombre: true } },
        },
      },
      variante: varianteInclude,
    },
  },
  // La compra que viene a cubrir este faltante (si hay una ligada) y el envío en que viaja.
  compraDetalle: {
    select: {
      id: true,
      cantidad: true,
      proveedor: { select: { id: true, nombre: true } },
      proforma: { select: { id: true, codigo: true, estado: true, envio: { select: { id: true, codigo: true, estado: true } } } },
    },
  },
} satisfies Prisma.ProformaDetalleAsignacionInclude;

type LineaConCompra = Prisma.ProformaDetalleAsignacionGetPayload<{ include: typeof includeLinea }>;

/** Estado de un pedido de cliente según la compra/envío que lo cubre. Si la compra ligada ya se cerró
 * (COMPLETADA/ANULADA) y la Procura sigue pendiente, es que no llegó todo: vuelve a "sin compra". */
export function derivarEstadoPedido(linea: Pick<LineaConCompra, "compraDetalle">): EstadoPedido {
  const compra = linea.compraDetalle?.proforma;
  if (!compra) return "SIN_COMPRA";
  if (compra.estado === EstadoProforma.BORRADOR) return "EN_PREPARACION";
  if (compra.estado !== EstadoProforma.APROBADA) return "SIN_COMPRA";
  return compra.envio?.estado === EstadoEnvio.EN_TRANSITO ? "EN_TRANSITO" : "COMPRADO";
}

/** Misma lógica que derivarEstadoPedido pero como filtro de base de datos (para poder paginar). */
function whereEstadoPedido(estado: EstadoPedido): Prisma.ProformaDetalleAsignacionWhereInput {
  switch (estado) {
    case "SIN_COMPRA":
      return {
        OR: [
          { compraDetalleId: null },
          { compraDetalle: { proforma: { estado: { in: [EstadoProforma.COMPLETADA, EstadoProforma.ANULADA] } } } },
        ],
      };
    case "EN_PREPARACION":
      return { compraDetalle: { proforma: { estado: EstadoProforma.BORRADOR } } };
    case "EN_TRANSITO":
      return { compraDetalle: { proforma: { estado: EstadoProforma.APROBADA, envio: { estado: EstadoEnvio.EN_TRANSITO } } } };
    case "COMPRADO":
      return {
        compraDetalle: {
          proforma: {
            estado: EstadoProforma.APROBADA,
            OR: [{ envioId: null }, { envio: { estado: { not: EstadoEnvio.EN_TRANSITO } } }],
          },
        },
      };
  }
}

/**
 * Seguimiento en dos vistas, recalculadas en vivo (no son un snapshot):
 *  - Pedidos de clientes: las Procura (ventas aprobadas sin stock suficiente), con el estado derivado de
 *    la compra y el envío que las cubren (ver compraDetalleId en ProformaDetalleAsignacion). Cambian solas
 *    cuando una compra resuelve la Procura (procura.util.ts) o se anula la venta que la generaba.
 *  - Stock pedido: compras para reponer inventario ya aprobadas y todavía sin recibir.
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
      ...(query.estado ? whereEstadoPedido(query.estado) : {}),
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

    return { items: items.map((item) => ({ ...item, estadoPedido: derivarEstadoPedido(item) })), total, page, pageSize };
  }

  /** Líneas de compra "para stock" ya aprobadas y todavía sin recibir: lo que se pidió para reponer
   * inventario (a diferencia de findPendientes, que son faltantes de notas de venta). */
  async findStockPedido(query: QuerySeguimientoDto) {
    const categoryIds = query.categoryId ? await this.collectCategoryIds(query.categoryId) : undefined;
    const enTransito = query.estado === "EN_TRANSITO";
    const comprado = query.estado === "COMPRADO";

    const where: Prisma.ProformaDetalleWhereInput = {
      destino: DestinoCompra.STOCK,
      proforma: {
        tipo: TipoProforma.COMPRA,
        estado: EstadoProforma.APROBADA,
        empresaId: query.empresaId,
        ...(enTransito ? { envio: { estado: EstadoEnvio.EN_TRANSITO } } : {}),
        ...(comprado ? { OR: [{ envioId: null }, { envio: { estado: { not: EstadoEnvio.EN_TRANSITO } } }] } : {}),
      },
      variante: categoryIds ? { product: { categoryId: { in: categoryIds } } } : undefined,
    };

    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });

    const [rows, total] = await Promise.all([
      this.prisma.proformaDetalle.findMany({
        where,
        orderBy: [{ variante: { product: { name: "asc" } } }, { proforma: { fecha: "asc" } }],
        skip,
        take,
        select: {
          id: true,
          cantidad: true,
          proveedor: { select: { id: true, nombre: true } },
          proforma: {
            select: {
              id: true,
              codigo: true,
              fecha: true,
              empresa: { select: { id: true, nombre: true } },
              envio: { select: { id: true, codigo: true, estado: true, almacenDestino: { select: { id: true, nombre: true } } } },
            },
          },
          variante: varianteInclude,
        },
      }),
      this.prisma.proformaDetalle.count({ where }),
    ]);

    const items = rows.map((r) => ({
      ...r,
      estadoStock: r.proforma.envio?.estado === EstadoEnvio.EN_TRANSITO ? ("EN_TRANSITO" as const) : ("COMPRADO" as const),
    }));
    return { items, total, page, pageSize };
  }

  private async getProcura(id: string) {
    const asignacion = await this.prisma.proformaDetalleAsignacion.findUnique({
      where: { id },
      include: { proformaDetalle: { select: { varianteId: true, proforma: { select: { estado: true } } } } },
    });
    if (!asignacion) throw new NotFoundException("Línea de Procura no encontrada.");
    if (asignacion.origen !== OrigenAsignacion.PROCURA || asignacion.cantidad <= 0) {
      throw new BadRequestException("Solo se puede ligar un faltante pendiente (Procura).");
    }
    if (asignacion.proformaDetalle.proforma.estado !== EstadoProforma.APROBADA) {
      throw new ConflictException("La nota de venta ya no está aprobada.");
    }
    return asignacion;
  }

  /** Líneas de compra (destino PEDIDO, de la misma variante) a las que se puede ligar este faltante,
   * con cuánto les queda por cubrir. */
  async comprasCandidatas(asignacionId: string) {
    const asignacion = await this.getProcura(asignacionId);
    const compras = await this.prisma.proformaDetalle.findMany({
      where: {
        destino: DestinoCompra.PEDIDO,
        varianteId: asignacion.proformaDetalle.varianteId,
        proforma: { tipo: TipoProforma.COMPRA, estado: { in: [EstadoProforma.BORRADOR, EstadoProforma.APROBADA] } },
      },
      select: {
        id: true,
        cantidad: true,
        proveedor: { select: { id: true, nombre: true } },
        proforma: { select: { id: true, codigo: true, estado: true, envio: { select: { id: true, codigo: true, estado: true } } } },
        asignacionesCubiertas: { select: { id: true, cantidad: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return compras.map(({ asignacionesCubiertas, ...c }) => ({
      ...c,
      restante: c.cantidad - asignacionesCubiertas.filter((a) => a.id !== asignacionId).reduce((s, a) => s + a.cantidad, 0),
    }));
  }

  /** Faltantes de notas de venta aprobadas (de la misma variante) que esta línea de compra puede cubrir. */
  async procurasPendientesParaCompra(compraDetalleId: string) {
    const compra = await this.prisma.proformaDetalle.findUnique({
      where: { id: compraDetalleId },
      select: { varianteId: true, proforma: { select: { tipo: true } } },
    });
    if (!compra || compra.proforma.tipo !== TipoProforma.COMPRA) throw new NotFoundException("Línea de compra no encontrada.");
    return this.prisma.proformaDetalleAsignacion.findMany({
      where: {
        origen: OrigenAsignacion.PROCURA,
        cantidad: { gt: 0 },
        OR: [{ compraDetalleId: null }, { compraDetalleId }],
        proformaDetalle: { varianteId: compra.varianteId, proforma: { tipo: TipoProforma.VENTA, estado: EstadoProforma.APROBADA } },
      },
      select: {
        id: true,
        cantidad: true,
        compraDetalleId: true,
        proformaDetalle: {
          select: { proforma: { select: { id: true, codigo: true, fecha: true, cliente: { select: { id: true, nombre: true } } } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Liga (todo o parte de) un faltante a una línea de compra "Pedido de cliente". Una compra puede cubrir
   * solo una parte del faltante y varias compras pueden cubrir el mismo faltante: si `cantidad` es menor
   * a lo que falta, la fila se parte en dos — la cantidad ligada queda en una fila propia con la compra
   * y el resto sigue libre para ligarse a otra. Sin `cantidad` se liga lo máximo que cabe.
   */
  async vincular(asignacionId: string, compraDetalleId: string, cantidad?: number) {
    const asignacion = await this.getProcura(asignacionId);
    if (asignacion.compraDetalleId) {
      throw new ConflictException("Ese faltante ya está ligado a una compra: soltalo primero para ligarlo a otra.");
    }
    const compra = await this.prisma.proformaDetalle.findUnique({
      where: { id: compraDetalleId },
      select: {
        varianteId: true,
        destino: true,
        cantidad: true,
        proforma: { select: { tipo: true, estado: true, codigo: true } },
        asignacionesCubiertas: { select: { id: true, cantidad: true } },
      },
    });
    if (!compra || compra.proforma.tipo !== TipoProforma.COMPRA) throw new BadRequestException("Línea de compra inválida.");
    if (compra.destino !== DestinoCompra.PEDIDO) {
      throw new ConflictException(`Esa línea de ${compra.proforma.codigo} es para stock: marcala como "Pedido de cliente" primero.`);
    }
    if (compra.proforma.estado !== EstadoProforma.BORRADOR && compra.proforma.estado !== EstadoProforma.APROBADA) {
      throw new ConflictException(`La compra ${compra.proforma.codigo} ya está ${compra.proforma.estado}.`);
    }
    if (compra.varianteId !== asignacion.proformaDetalle.varianteId) {
      throw new BadRequestException("La compra es de otro producto distinto al del faltante.");
    }

    const libre = compra.cantidad - compra.asignacionesCubiertas.reduce((s, a) => s + a.cantidad, 0);
    if (libre <= 0) {
      throw new ConflictException(`La línea de compra de ${compra.proforma.codigo} ya tiene todas sus unidades ligadas.`);
    }
    const aLigar = cantidad ?? Math.min(asignacion.cantidad, libre);
    if (aLigar > asignacion.cantidad) {
      throw new BadRequestException(`El faltante es de ${asignacion.cantidad} unidad(es): no se pueden ligar ${aLigar}.`);
    }
    if (aLigar > libre) {
      throw new ConflictException(`La línea de compra solo tiene ${libre} unidad(es) sin cubrir y quisiste ligar ${aLigar}.`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Si este mismo faltante ya tiene una fila ligada a esa compra, lo que se liga se suma a ella.
      const existente = await tx.proformaDetalleAsignacion.findFirst({
        where: { proformaDetalleId: asignacion.proformaDetalleId, origen: OrigenAsignacion.PROCURA, compraDetalleId, id: { not: asignacionId } },
      });

      if (aLigar === asignacion.cantidad) {
        if (existente) {
          await tx.proformaDetalleAsignacion.delete({ where: { id: asignacionId } });
          return tx.proformaDetalleAsignacion.update({ where: { id: existente.id }, data: { cantidad: { increment: aLigar } }, include: includeLinea });
        }
        return tx.proformaDetalleAsignacion.update({ where: { id: asignacionId }, data: { compraDetalleId }, include: includeLinea });
      }

      // Ligado parcial: se descuenta del faltante libre y se suma a la fila ya ligada a esta compra (o se crea una nueva).
      await tx.proformaDetalleAsignacion.update({ where: { id: asignacionId }, data: { cantidad: { decrement: aLigar } } });
      if (existente) {
        return tx.proformaDetalleAsignacion.update({ where: { id: existente.id }, data: { cantidad: { increment: aLigar } }, include: includeLinea });
      }
      return tx.proformaDetalleAsignacion.create({
        data: {
          proformaDetalleId: asignacion.proformaDetalleId,
          almacenId: asignacion.almacenId,
          cantidad: aLigar,
          origen: OrigenAsignacion.PROCURA,
          estadoSeguimiento: asignacion.estadoSeguimiento,
          compraDetalleId,
        },
        include: includeLinea,
      });
    });
  }

  /** Suelta un faltante de su compra. Si el mismo faltante ya tiene otra fila libre, se funden en una sola. */
  async desvincular(asignacionId: string) {
    const asignacion = await this.prisma.proformaDetalleAsignacion.findUnique({ where: { id: asignacionId } });
    if (!asignacion) throw new NotFoundException("Línea de Procura no encontrada.");
    if (!asignacion.compraDetalleId) return this.prisma.proformaDetalleAsignacion.findUniqueOrThrow({ where: { id: asignacionId }, include: includeLinea });

    return this.prisma.$transaction(async (tx) => {
      const libre = await tx.proformaDetalleAsignacion.findFirst({
        where: {
          proformaDetalleId: asignacion.proformaDetalleId,
          origen: OrigenAsignacion.PROCURA,
          compraDetalleId: null,
          id: { not: asignacionId },
        },
      });
      if (libre) {
        await tx.proformaDetalleAsignacion.delete({ where: { id: asignacionId } });
        return tx.proformaDetalleAsignacion.update({ where: { id: libre.id }, data: { cantidad: { increment: asignacion.cantidad } }, include: includeLinea });
      }
      return tx.proformaDetalleAsignacion.update({ where: { id: asignacionId }, data: { compraDetalleId: null }, include: includeLinea });
    });
  }

  /**
   * Legado: el estado manual (Pendiente/Comprado/Enviado) ya no gobierna lo que muestra el Seguimiento
   * (ahora se deriva de la compra/envío ligados), pero el endpoint se conserva por compatibilidad.
   * Puede venir parcial: si `dto.cantidad` cubre toda la línea, se actualiza in-place; si es menor, la
   * línea se parte en dos — la cantidad indicada pasa al nuevo estado en una fila nueva, el resto queda
   * en la fila original. Seguro de hacer: las filas PROCURA nunca tienen `consumos`.
   */
  async updateEstado(id: string, dto: UpdateEstadoSeguimientoDto) {
    const asignacion = await this.prisma.proformaDetalleAsignacion.findUnique({ where: { id } });
    if (!asignacion) {
      throw new NotFoundException("Línea de Procura no encontrada.");
    }
    if (asignacion.origen !== OrigenAsignacion.PROCURA) {
      throw new BadRequestException("El seguimiento solo aplica a líneas a Procura.");
    }
    if (dto.cantidad > asignacion.cantidad) {
      throw new BadRequestException(`La cantidad no puede superar la cantidad pendiente de la línea (${asignacion.cantidad}).`);
    }

    if (dto.estado === asignacion.estadoSeguimiento) {
      return this.prisma.proformaDetalleAsignacion.findUniqueOrThrow({ where: { id }, include: includeLinea });
    }

    if (dto.cantidad === asignacion.cantidad) {
      return this.prisma.proformaDetalleAsignacion.update({
        where: { id },
        data: { estadoSeguimiento: dto.estado },
        include: includeLinea,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.proformaDetalleAsignacion.update({ where: { id }, data: { cantidad: { decrement: dto.cantidad } } });
      return tx.proformaDetalleAsignacion.create({
        data: {
          proformaDetalleId: asignacion.proformaDetalleId,
          almacenId: asignacion.almacenId,
          cantidad: dto.cantidad,
          origen: asignacion.origen,
          estadoSeguimiento: dto.estado,
          compraDetalleId: asignacion.compraDetalleId,
        },
        include: includeLinea,
      });
    });
  }
}
