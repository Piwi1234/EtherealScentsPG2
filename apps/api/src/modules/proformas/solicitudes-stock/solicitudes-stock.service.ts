import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoProforma, EstadoSolicitudStock, Prisma, TipoProforma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../../common/prisma.service";
import { generateUniqueEntityCode } from "../../../catalog/entity-code";
import { compraConEnlacesSelect, enviadasDeEnlace, recogidasDeEnlace, type CompraConEnlaces } from "../recojo.util";
import {
  CreateSolicitudDto,
  LineaSolicitudDto,
  QuerySolicitudDto,
  UpdateLineaSolicitudDto,
  UpdateSolicitudDto,
} from "./dto/solicitud.dto";

export type EstadoLineaSolicitud = "SIN_COMPRA" | "EN_PREPARACION" | "COMPRADO" | "RECOGIDO" | "EN_TRANSITO" | "RECIBIDA";

const varianteInclude = {
  product: {
    include: {
      brand: true,
      attributeValues: { include: { attribute: true, option: true } },
      variantOptionValues: { include: { attribute: true } },
    },
  },
  options: { include: { optionValue: { include: { attribute: true } } } },
} satisfies Prisma.ProductVariantInclude;

const lineaInclude = {
  variante: { include: varianteInclude },
  compraDetalle: {
    select: {
      id: true,
      cantidad: true,
      proveedor: { select: { id: true, nombre: true } },
      proforma: { select: { id: true, codigo: true, estado: true } },
      ...compraConEnlacesSelect,
    },
  },
} satisfies Prisma.SolicitudStockLineaInclude;

const solicitudInclude = {
  creadoPor: { select: { id: true, nombre: true } },
  lineas: { include: lineaInclude, orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.SolicitudStockInclude;

type LineaConCompra = { cantidad?: number; cantidadRecibida?: number; compraDetalle: { proforma: { estado: EstadoProforma } } | null };

/** Estado DERIVADO de una línea de solicitud según la compra/envío que la cubre (RECIBIDA: ya llegó todo lo pedido). */
export function estadoLineaSolicitud(linea: LineaConCompra, recogidas = 0, enviadas = 0): EstadoLineaSolicitud {
  const compra = linea.compraDetalle?.proforma;
  if (!compra) return "SIN_COMPRA";
  if (compra.estado === EstadoProforma.COMPLETADA) return "RECIBIDA";
  if (linea.cantidad !== undefined && linea.cantidadRecibida !== undefined && linea.cantidadRecibida >= linea.cantidad) return "RECIBIDA";
  if (compra.estado === EstadoProforma.BORRADOR) return "EN_PREPARACION";
  if (compra.estado !== EstadoProforma.APROBADA) return "SIN_COMPRA";
  if (linea.cantidad !== undefined && enviadas >= linea.cantidad) return "EN_TRANSITO";
  return linea.cantidad !== undefined && recogidas >= linea.cantidad ? "RECOGIDO" : "COMPRADO";
}

/** Estado de la solicitud entera: cancelada, cerrada (todo recibido) o abierta. */
export function estadoSolicitud(s: { estado: EstadoSolicitudStock; lineas: LineaConCompra[] }): "ABIERTA" | "CERRADA" | "CANCELADA" {
  if (s.estado === EstadoSolicitudStock.CANCELADA) return "CANCELADA";
  if (s.lineas.length > 0 && s.lineas.every((l) => estadoLineaSolicitud(l) === "RECIBIDA")) return "CERRADA";
  return "ABIERTA";
}

/**
 * Solicitudes de stock: un pedido interno de mercadería para inventario (no es una venta ni una compra).
 * Aparecen en Seguimiento junto a los faltantes de clientes y se compran con "Crear compras"; cada línea
 * se liga (parcial o completa) a líneas de compra y avanza sola: comprada, en tránsito, recibida.
 */
@Injectable()
export class SolicitudesStockService {
  constructor(private readonly prisma: PrismaService) {}

  private conEstado<
    T extends {
      estado: EstadoSolicitudStock;
      lineas: (LineaConCompra & { id: string; cantidad: number; cantidadRecibida: number; compraDetalle: (LineaConCompra["compraDetalle"] & CompraConEnlaces) | null })[];
    },
  >(s: T) {
    return {
      ...s,
      estadoDerivado: estadoSolicitud(s),
      lineas: s.lineas.map((l) => {
        const recogidas = l.compraDetalle ? recogidasDeEnlace(l.compraDetalle, l.id) : 0;
        const enviadas = l.compraDetalle ? enviadasDeEnlace(l.compraDetalle, l.id) : 0;
        return { ...l, recogidas, enviadas, estadoLinea: estadoLineaSolicitud(l, recogidas, enviadas) };
      }),
    };
  }

  async findAll(query: QuerySolicitudDto) {
    const { page, pageSize, skip, take } = getPagination({ page: String(query.page ?? 1), pageSize: String(query.limit ?? 20) });

    const where: Prisma.SolicitudStockWhereInput = {
      ...(query.estado === "CANCELADA"
        ? { estado: EstadoSolicitudStock.CANCELADA }
        : query.estado === "CERRADA" || query.estado === "ABIERTA"
          ? { estado: EstadoSolicitudStock.ABIERTA }
          : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { codigo: { contains: query.search.trim(), mode: "insensitive" as const } },
              { lineas: { some: { variante: { product: { name: { contains: query.search.trim(), mode: "insensitive" as const } } } } } },
            ],
          }
        : {}),
    };

    // "Abierta" vs "cerrada" depende de cuánto llegó de cada línea (no se puede comparar columnas en SQL): se resuelve en memoria.
    if (query.estado === "CERRADA" || query.estado === "ABIERTA") {
      const todas = await this.prisma.solicitudStock.findMany({ where, orderBy: { createdAt: "desc" }, include: solicitudInclude });
      const filtradas = todas.map((s) => this.conEstado(s)).filter((s) => s.estadoDerivado === query.estado);
      return { items: filtradas.slice(skip, skip + take), total: filtradas.length, page, pageSize };
    }

    const [items, total] = await Promise.all([
      this.prisma.solicitudStock.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: solicitudInclude }),
      this.prisma.solicitudStock.count({ where }),
    ]);
    return { items: items.map((s) => this.conEstado(s)), total, page, pageSize };
  }

  async findOne(id: string) {
    const solicitud = await this.prisma.solicitudStock.findUnique({ where: { id }, include: solicitudInclude });
    if (!solicitud) throw new NotFoundException("Solicitud de stock no encontrada.");
    return this.conEstado(solicitud);
  }

  private async assertAbierta(id: string) {
    const s = await this.prisma.solicitudStock.findUnique({ where: { id }, select: { estado: true } });
    if (!s) throw new NotFoundException("Solicitud de stock no encontrada.");
    if (s.estado !== EstadoSolicitudStock.ABIERTA) throw new ConflictException("La solicitud está cancelada.");
  }

  private async assertVariantes(lineas: LineaSolicitudDto[]) {
    const ids = Array.from(new Set(lineas.map((l) => l.varianteId)));
    const encontradas = await this.prisma.productVariant.count({ where: { id: { in: ids } } });
    if (encontradas !== ids.length) throw new BadRequestException("Alguno de los productos no existe.");
  }

  async create(dto: CreateSolicitudDto, usuarioId: string) {
    if (dto.lineas) await this.assertVariantes(dto.lineas);
    const codigo = await generateUniqueEntityCode(async (code) => Boolean(await this.prisma.solicitudStock.findUnique({ where: { codigo: code }, select: { id: true } })));

    // Un mismo producto repetido se suma en una sola línea.
    const porVariante = new Map<string, LineaSolicitudDto>();
    for (const l of dto.lineas ?? []) {
      const previa = porVariante.get(l.varianteId);
      porVariante.set(l.varianteId, previa ? { ...previa, cantidad: previa.cantidad + l.cantidad } : l);
    }

    const creada = await this.prisma.solicitudStock.create({
      data: {
        codigo,
        nota: dto.nota?.trim() || undefined,
        creadoPorId: usuarioId,
        lineas: { create: Array.from(porVariante.values()).map((l) => ({ varianteId: l.varianteId, cantidad: l.cantidad, nota: l.nota })) },
      },
    });
    return this.findOne(creada.id);
  }

  async update(id: string, dto: UpdateSolicitudDto) {
    await this.assertAbierta(id);
    await this.prisma.solicitudStock.update({ where: { id }, data: { nota: dto.nota?.trim() || null } });
    return this.findOne(id);
  }

  async addLinea(id: string, dto: LineaSolicitudDto) {
    await this.assertAbierta(id);
    await this.assertVariantes([dto]);
    // Si ya hay una línea libre de ese producto, se suma en vez de duplicar.
    const existente = await this.prisma.solicitudStockLinea.findFirst({ where: { solicitudId: id, varianteId: dto.varianteId, compraDetalleId: null } });
    if (existente) {
      await this.prisma.solicitudStockLinea.update({ where: { id: existente.id }, data: { cantidad: { increment: dto.cantidad } } });
    } else {
      await this.prisma.solicitudStockLinea.create({ data: { solicitudId: id, varianteId: dto.varianteId, cantidad: dto.cantidad, nota: dto.nota } });
    }
    return this.findOne(id);
  }

  private async getLineaLibre(id: string, lineaId: string) {
    await this.assertAbierta(id);
    const linea = await this.prisma.solicitudStockLinea.findUnique({ where: { id: lineaId } });
    if (!linea || linea.solicitudId !== id) throw new NotFoundException("Línea no encontrada.");
    if (linea.compraDetalleId) throw new ConflictException("La línea ya está ligada a una compra: soltala primero.");
    return linea;
  }

  async updateLinea(id: string, lineaId: string, dto: UpdateLineaSolicitudDto) {
    await this.getLineaLibre(id, lineaId);
    await this.prisma.solicitudStockLinea.update({ where: { id: lineaId }, data: { cantidad: dto.cantidad, nota: dto.nota } });
    return this.findOne(id);
  }

  async removeLinea(id: string, lineaId: string) {
    await this.getLineaLibre(id, lineaId);
    await this.prisma.solicitudStockLinea.delete({ where: { id: lineaId } });
    return this.findOne(id);
  }

  /** Cancela la solicitud: las líneas se sueltan de sus compras (que siguen su curso) y deja de aparecer en Seguimiento. */
  async cancelar(id: string) {
    await this.assertAbierta(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.solicitudStockLinea.updateMany({ where: { solicitudId: id }, data: { compraDetalleId: null } });
      await tx.solicitudStock.update({ where: { id }, data: { estado: EstadoSolicitudStock.CANCELADA } });
    });
    return this.findOne(id);
  }

  /** Línea de una solicitud abierta, todavía sin compra: lo que "Crear compras" y "Ligar" pueden tomar. */
  async getLineaParaLigar(lineaId: string) {
    const linea = await this.prisma.solicitudStockLinea.findUnique({ where: { id: lineaId }, include: { solicitud: { select: { estado: true } } } });
    if (!linea) throw new NotFoundException("Línea de solicitud no encontrada.");
    if (linea.solicitud.estado !== EstadoSolicitudStock.ABIERTA) throw new ConflictException("La solicitud está cancelada.");
    if (linea.compraDetalleId) throw new ConflictException("Esa línea de solicitud ya está ligada a una compra: soltala primero.");
    return linea;
  }

  /**
   * Liga (todo o parte de) una línea de solicitud a una línea de compra. Igual que con los faltantes de
   * ventas, si `cantidad` es menor la línea se parte: lo ligado queda en una fila con la compra y el resto
   * sigue libre. El tope es lo que le queda libre a la compra (restando ventas y otras solicitudes).
   */
  async vincularLinea(lineaId: string, compraDetalleId: string, cantidad?: number) {
    const linea = await this.getLineaParaLigar(lineaId);
    const compra = await this.prisma.proformaDetalle.findUnique({
      where: { id: compraDetalleId },
      select: {
        varianteId: true,
        cantidad: true,
        proforma: { select: { tipo: true, estado: true, codigo: true } },
        asignacionesCubiertas: { select: { cantidad: true } },
        solicitudesCubiertas: { select: { cantidad: true } },
      },
    });
    if (!compra || compra.proforma.tipo !== TipoProforma.COMPRA) throw new BadRequestException("Línea de compra inválida.");
    if (compra.proforma.estado !== EstadoProforma.BORRADOR && compra.proforma.estado !== EstadoProforma.APROBADA) {
      throw new ConflictException(`La compra ${compra.proforma.codigo} ya está ${compra.proforma.estado}.`);
    }
    if (compra.varianteId !== linea.varianteId) throw new BadRequestException("La compra es de otro producto distinto al de la solicitud.");

    const libre =
      compra.cantidad -
      compra.asignacionesCubiertas.reduce((n, a) => n + a.cantidad, 0) -
      compra.solicitudesCubiertas.reduce((n, a) => n + a.cantidad, 0);
    if (libre <= 0) throw new ConflictException(`La línea de compra de ${compra.proforma.codigo} ya tiene todas sus unidades ligadas.`);
    const aLigar = cantidad ?? Math.min(linea.cantidad, libre);
    if (aLigar > linea.cantidad) throw new BadRequestException(`La línea pide ${linea.cantidad} unidad(es): no se pueden ligar ${aLigar}.`);
    if (aLigar > libre) throw new ConflictException(`La línea de compra solo tiene ${libre} unidad(es) sin cubrir y quisiste ligar ${aLigar}.`);

    return this.prisma.$transaction(async (tx) => {
      const existente = await tx.solicitudStockLinea.findFirst({
        where: { solicitudId: linea.solicitudId, varianteId: linea.varianteId, compraDetalleId, id: { not: lineaId } },
      });
      if (aLigar === linea.cantidad) {
        if (existente) {
          await tx.solicitudStockLinea.delete({ where: { id: lineaId } });
          return tx.solicitudStockLinea.update({ where: { id: existente.id }, data: { cantidad: { increment: aLigar } }, include: lineaInclude });
        }
        return tx.solicitudStockLinea.update({ where: { id: lineaId }, data: { compraDetalleId }, include: lineaInclude });
      }
      await tx.solicitudStockLinea.update({ where: { id: lineaId }, data: { cantidad: { decrement: aLigar } } });
      if (existente) {
        return tx.solicitudStockLinea.update({ where: { id: existente.id }, data: { cantidad: { increment: aLigar } }, include: lineaInclude });
      }
      return tx.solicitudStockLinea.create({
        data: { solicitudId: linea.solicitudId, varianteId: linea.varianteId, cantidad: aLigar, nota: linea.nota, compraDetalleId },
        include: lineaInclude,
      });
    });
  }

  /** Suelta una línea de su compra; si la solicitud ya tiene otra línea libre del mismo producto, se funden. */
  async desvincularLinea(lineaId: string) {
    const linea = await this.prisma.solicitudStockLinea.findUnique({ where: { id: lineaId } });
    if (!linea) throw new NotFoundException("Línea de solicitud no encontrada.");
    if (!linea.compraDetalleId) return this.prisma.solicitudStockLinea.findUniqueOrThrow({ where: { id: lineaId }, include: lineaInclude });

    return this.prisma.$transaction(async (tx) => {
      const libre = await tx.solicitudStockLinea.findFirst({
        where: { solicitudId: linea.solicitudId, varianteId: linea.varianteId, compraDetalleId: null, id: { not: lineaId } },
      });
      if (libre) {
        await tx.solicitudStockLinea.delete({ where: { id: lineaId } });
        return tx.solicitudStockLinea.update({ where: { id: libre.id }, data: { cantidad: { increment: linea.cantidad } }, include: lineaInclude });
      }
      return tx.solicitudStockLinea.update({ where: { id: lineaId }, data: { compraDetalleId: null }, include: lineaInclude });
    });
  }
}
