import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoProforma, EstadoSolicitudStock, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../../common/prisma.service";
import { ProformasService } from "../proformas.service";
import { compraConEnlacesSelect, enviadasDeEnlace, estadoSegunCompra, recogidasDeEnlace, totalEnviado, totalRecogido } from "../recojo.util";
import { SolicitudesStockService, estadoLineaSolicitud } from "../solicitudes-stock/solicitudes-stock.service";
import { EstadoPedido, QuerySeguimientoDto } from "./dto/query-seguimiento.dto";
import { UpdateEstadoSeguimientoDto } from "./dto/update-estado-seguimiento.dto";
import { CrearComprasDto } from "./dto/crear-compras.dto";
import { recalcularTransitoLinea } from "../transito.util";

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
      proforma: { select: { id: true, codigo: true, estado: true } },
      ...compraConEnlacesSelect,
    },
  },
} satisfies Prisma.ProformaDetalleAsignacionInclude;

type LineaConCompra = Prisma.ProformaDetalleAsignacionGetPayload<{ include: typeof includeLinea }>;

/** Estado de un pedido de cliente según la compra/envío que lo cubre. Si la compra ligada ya se cerró
 * (COMPLETADA/ANULADA) y la Procura sigue pendiente, es que no llegó todo: vuelve a "sin compra". */
export function derivarEstadoPedido(linea: Pick<LineaConCompra, "compraDetalle" | "cantidad">, recogidas = 0, enviadas = 0): EstadoPedido {
  return estadoSegunCompra(linea.compraDetalle?.proforma.estado, linea.cantidad, recogidas, enviadas);
}

/** Agrega a una línea de Seguimiento cuántas unidades ya se recogieron/enviaron para ella y su estado derivado. */
function conEstadoPedido(item: LineaConCompra) {
  const recogidas = item.compraDetalle ? recogidasDeEnlace(item.compraDetalle, item.id) : 0;
  const enviadas = item.compraDetalle ? enviadasDeEnlace(item.compraDetalle, item.id) : 0;
  return { ...item, recogidas, enviadas, estadoPedido: derivarEstadoPedido(item, recogidas, enviadas) };
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
    case "COMPRADO":
    case "RECOGIDO":
    case "EN_TRANSITO":
      // Comparten el filtro de base de datos (compra aprobada); la diferencia (cuánto se recogió y cuánto
      // se envió) se resuelve en memoria, ver findPendientes.
      return { compraDetalle: { proforma: { estado: EstadoProforma.APROBADA } } };
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly proformas: ProformasService,
    private readonly solicitudes: SolicitudesStockService,
  ) {}

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

  /** Filtro de producto: categoría (con subcategorías) y/o texto — cada palabra exige su match (nombre, código o marca). */
  private varianteWhere(categoryIds: string[] | undefined, search: string | undefined): Prisma.ProductVariantWhereInput | undefined {
    const palabras = search?.trim() ? search.trim().split(/\s+/).filter(Boolean) : [];
    if (!categoryIds && palabras.length === 0) return undefined;
    return {
      product: {
        categoryId: categoryIds ? { in: categoryIds } : undefined,
        ...(palabras.length > 0
          ? {
              AND: palabras.map((word) => ({
                OR: [
                  { name: { contains: word, mode: "insensitive" as const } },
                  { productCode: { contains: word, mode: "insensitive" as const } },
                  { brand: { name: { contains: word, mode: "insensitive" as const } } },
                ],
              })),
            }
          : {}),
      },
    };
  }

  async findPendientes(query: QuerySeguimientoDto) {
    const categoryIds = query.categoryId ? await this.collectCategoryIds(query.categoryId) : undefined;

    const where: Prisma.ProformaDetalleAsignacionWhereInput = {
      origen: OrigenAsignacion.PROCURA,
      cantidad: { gt: 0 },
      ...(query.estado ? whereEstadoPedido(query.estado) : {}),
      proformaDetalle: {
        proforma: query.empresaId || query.clienteId ? { empresaId: query.empresaId, clienteId: query.clienteId } : undefined,
        variante: this.varianteWhere(categoryIds, query.search),
      },
    };

    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });

    // Por producto, y dentro de cada producto de la más antigua a la más nueva.
    const orderBy: Prisma.ProformaDetalleAsignacionOrderByWithRelationInput[] = [
      { proformaDetalle: { variante: { product: { name: "asc" } } } },
      { proformaDetalle: { proforma: { fecha: "asc" } } },
    ];

    // "Comprado", "Recogido" y "Enviado" dependen de cuánto se recogió/envió (se reparte entre los vínculos de la
    // línea de compra), así que para esos filtros se calcula en memoria y se pagina después.
    if (query.estado === "COMPRADO" || query.estado === "RECOGIDO" || query.estado === "EN_TRANSITO") {
      const todos = await this.prisma.proformaDetalleAsignacion.findMany({ where, orderBy, include: includeLinea });
      const filtrados = todos.map(conEstadoPedido).filter((i) => i.estadoPedido === query.estado);
      return { items: filtrados.slice(skip, skip + take), total: filtrados.length, page, pageSize };
    }

    const [items, total] = await Promise.all([
      this.prisma.proformaDetalleAsignacion.findMany({ where, orderBy, include: includeLinea, skip, take }),
      this.prisma.proformaDetalleAsignacion.count({ where }),
    ]);

    return { items: items.map(conEstadoPedido), total, page, pageSize };
  }

  /** Stock en compra: la parte de líneas de compra aprobadas, todavía sin recibir, que NO está ligada a
   * ninguna venta (es lo que va a reponer inventario). A diferencia de findPendientes, que son faltantes
   * de notas de venta. */
  async findStockPedido(query: QuerySeguimientoDto) {
    const categoryIds = query.categoryId ? await this.collectCategoryIds(query.categoryId) : undefined;

    const where: Prisma.ProformaDetalleWhereInput = {
      proforma: {
        tipo: TipoProforma.COMPRA,
        estado: EstadoProforma.APROBADA,
        empresaId: query.empresaId,
      },
      variante: this.varianteWhere(categoryIds, query.search),
    };

    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });

    // La parte libre (cantidad - ligado) y su estado (recogida/enviada) no se pueden filtrar en SQL: se calculan
    // acá y se pagina después.
    const rows = await this.prisma.proformaDetalle.findMany({
      where,
      orderBy: [{ variante: { product: { name: "asc" } } }, { proforma: { fecha: "asc" } }],
      select: {
        id: true,
        cantidad: true,
        ...compraConEnlacesSelect,
        proveedor: { select: { id: true, nombre: true } },
        proforma: {
          select: {
            id: true,
            codigo: true,
            fecha: true,
            empresa: { select: { id: true, nombre: true } },
          },
        },
        variante: varianteInclude,
      },
    });

    const conLibre = rows
      .map(({ asignacionesCubiertas, solicitudesCubiertas, recojoLineas, envioItems, ...r }) => {
        const ligadas = asignacionesCubiertas.reduce((n, a) => n + a.cantidad, 0) + solicitudesCubiertas.reduce((n, a) => n + a.cantidad, 0);
        const libre = r.cantidad - ligadas;
        // Los vínculos (ventas y solicitudes) se sirven primero: lo libre es lo que sobra de lo recogido/enviado.
        const enviadoLibre = Math.max(0, totalEnviado({ envioItems }) - ligadas);
        const recogidoLibre = Math.max(0, totalRecogido({ recojoLineas }) - ligadas);
        const estadoStock = enviadoLibre >= libre ? ("EN_TRANSITO" as const) : recogidoLibre >= libre ? ("RECOGIDO" as const) : ("COMPRADO" as const);
        const envios = Array.from(new Map(envioItems.map((it) => [it.envio.id, it.envio])).values());
        return { ...r, cantidad: libre, recogidas: Math.min(recogidoLibre, libre), estadoStock, envios };
      })
      .filter((r) => r.cantidad > 0)
      .filter((r) => !query.estado || r.estadoStock === query.estado);

    const items = conLibre.slice(skip, skip + take);
    const total = conLibre.length;
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

  /** Líneas de compra (de la misma variante) a las que se puede ligar este faltante,
   * con cuánto les queda por cubrir. */
  async comprasCandidatas(asignacionId: string) {
    const asignacion = await this.getProcura(asignacionId);
    const compras = await this.prisma.proformaDetalle.findMany({
      where: {
        varianteId: asignacion.proformaDetalle.varianteId,
        proforma: { tipo: TipoProforma.COMPRA, estado: { in: [EstadoProforma.BORRADOR, EstadoProforma.APROBADA] } },
      },
      select: {
        id: true,
        cantidad: true,
        proveedor: { select: { id: true, nombre: true } },
        proforma: { select: { id: true, codigo: true, estado: true } },
        asignacionesCubiertas: { select: { id: true, cantidad: true } },
        solicitudesCubiertas: { select: { cantidad: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return compras.map(({ asignacionesCubiertas, solicitudesCubiertas, ...c }) => ({
      ...c,
      restante:
        c.cantidad -
        asignacionesCubiertas.filter((a) => a.id !== asignacionId).reduce((s, a) => s + a.cantidad, 0) -
        solicitudesCubiertas.reduce((s, a) => s + a.cantidad, 0),
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
        cantidad: true,
        proforma: { select: { tipo: true, estado: true, codigo: true } },
        asignacionesCubiertas: { select: { id: true, cantidad: true } },
        solicitudesCubiertas: { select: { cantidad: true } },
      },
    });
    if (!compra || compra.proforma.tipo !== TipoProforma.COMPRA) throw new BadRequestException("Línea de compra inválida.");
    if (compra.proforma.estado !== EstadoProforma.BORRADOR && compra.proforma.estado !== EstadoProforma.APROBADA) {
      throw new ConflictException(`La compra ${compra.proforma.codigo} ya está ${compra.proforma.estado}.`);
    }
    if (compra.varianteId !== asignacion.proformaDetalle.varianteId) {
      throw new BadRequestException("La compra es de otro producto distinto al del faltante.");
    }

    const libre =
      compra.cantidad -
      compra.asignacionesCubiertas.reduce((s, a) => s + a.cantidad, 0) -
      compra.solicitudesCubiertas.reduce((s, a) => s + a.cantidad, 0);
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
      const ligar = async () => {
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
      };
      const resultado = await ligar();
      // Si la compra viaja en un envío ya despachado, lo ligado deja de contar como stock en tránsito libre.
      await recalcularTransitoLinea(tx, compraDetalleId);
      return resultado;
    });
  }

  /** Líneas de solicitudes de stock abiertas que todavía no llegaron, con el estado derivado de la compra que las cubre. */
  async findStockSolicitado(query: QuerySeguimientoDto) {
    const categoryIds = query.categoryId ? await this.collectCategoryIds(query.categoryId) : undefined;
    const estado = query.estado as EstadoPedido | undefined;

    let porEstado: Prisma.SolicitudStockLineaWhereInput;
    switch (estado) {
      case "SIN_COMPRA":
        porEstado = { compraDetalleId: null };
        break;
      case "EN_PREPARACION":
        porEstado = { compraDetalle: { proforma: { estado: EstadoProforma.BORRADOR } } };
        break;
      case "COMPRADO":
      case "RECOGIDO":
      case "EN_TRANSITO":
        porEstado = { compraDetalle: { proforma: { estado: EstadoProforma.APROBADA } } };
        break;
      default:
        porEstado = {};
    }

    const where: Prisma.SolicitudStockLineaWhereInput = {
      solicitud: { estado: EstadoSolicitudStock.ABIERTA },
      variante: this.varianteWhere(categoryIds, query.search),
      ...porEstado,
    };
    const { page, pageSize, skip, take } = getPagination({ page: String(query.page ?? 1), pageSize: String(query.limit ?? 20) });

    const include = {
      solicitud: { select: { id: true, codigo: true, nota: true, createdAt: true, creadoPor: { select: { id: true, nombre: true } } } },
      variante: varianteInclude,
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
    const orderBy: Prisma.SolicitudStockLineaOrderByWithRelationInput[] = [{ variante: { product: { name: "asc" } } }, { createdAt: "asc" }];
    type LineaSol = Prisma.SolicitudStockLineaGetPayload<{ include: typeof include }>;
    const decorar = (l: LineaSol) => {
      const recogidas = l.compraDetalle ? recogidasDeEnlace(l.compraDetalle, l.id) : 0;
      const enviadas = l.compraDetalle ? enviadasDeEnlace(l.compraDetalle, l.id) : 0;
      return { ...l, recogidas, enviadas, estadoLinea: estadoLineaSolicitud(l, recogidas, enviadas) };
    };

    // El estado depende de cuánto se recogió/envió/recibió (no comparable en SQL): se resuelve en memoria. Sin
    // filtro, lo ya recibido sale del Seguimiento.
    const todos = await this.prisma.solicitudStockLinea.findMany({ where, orderBy, include });
    const filtrados = todos.map(decorar).filter((l) => (estado ? l.estadoLinea === estado : l.estadoLinea !== "RECIBIDA"));
    return { items: filtrados.slice(skip, skip + take), total: filtrados.length, page, pageSize };
  }

  /** Faltantes de ventas y líneas de solicitudes todavía sin compra de estos productos (para "Crear compras"). */
  async pendientesPorVariante(varianteIds: string[]) {
    if (varianteIds.length === 0) return { pedidos: [], stock: [] };
    const [procuras, lineas] = await Promise.all([
      this.prisma.proformaDetalleAsignacion.findMany({
        where: {
          origen: OrigenAsignacion.PROCURA,
          cantidad: { gt: 0 },
          compraDetalleId: null,
          proformaDetalle: { varianteId: { in: varianteIds }, proforma: { tipo: TipoProforma.VENTA, estado: EstadoProforma.APROBADA } },
        },
        select: { id: true, cantidad: true, proformaDetalle: { select: { varianteId: true, proforma: { select: { codigo: true } } } } },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.solicitudStockLinea.findMany({
        where: { compraDetalleId: null, varianteId: { in: varianteIds }, solicitud: { estado: EstadoSolicitudStock.ABIERTA } },
        select: { id: true, cantidad: true, varianteId: true, solicitud: { select: { codigo: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    return {
      pedidos: procuras.map((p) => ({ id: p.id, varianteId: p.proformaDetalle.varianteId, cantidad: p.cantidad, codigo: p.proformaDetalle.proforma.codigo })),
      stock: lineas.map((l) => ({ id: l.id, varianteId: l.varianteId, cantidad: l.cantidad, codigo: l.solicitud.codigo })),
    };
  }

  /** Líneas de solicitudes de stock (de la misma variante) que esta línea de compra puede cubrir. */
  async solicitudesPendientesParaCompra(compraDetalleId: string) {
    const compra = await this.prisma.proformaDetalle.findUnique({
      where: { id: compraDetalleId },
      select: { varianteId: true, proforma: { select: { tipo: true } } },
    });
    if (!compra || compra.proforma.tipo !== TipoProforma.COMPRA) throw new NotFoundException("Línea de compra no encontrada.");
    return this.prisma.solicitudStockLinea.findMany({
      where: {
        varianteId: compra.varianteId,
        cantidad: { gt: 0 },
        OR: [{ compraDetalleId: null }, { compraDetalleId }],
        solicitud: { estado: EstadoSolicitudStock.ABIERTA },
      },
      select: {
        id: true,
        cantidad: true,
        compraDetalleId: true,
        solicitud: { select: { id: true, codigo: true, creadoPor: { select: { id: true, nombre: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /** Último proveedor al que se le compró cada producto (para sugerirlo al crear compras desde los faltantes). */
  async sugerenciasCompra(varianteIds: string[]) {
    if (varianteIds.length === 0) return {};
    const lineas = await this.prisma.proformaDetalle.findMany({
      where: { varianteId: { in: varianteIds }, proveedorId: { not: null }, proforma: { tipo: TipoProforma.COMPRA } },
      orderBy: { createdAt: "desc" },
      select: { varianteId: true, proveedorId: true },
    });
    const resultado: Record<string, string> = {};
    for (const l of lineas) if (!(l.varianteId in resultado) && l.proveedorId) resultado[l.varianteId] = l.proveedorId;
    return resultado;
  }

  /**
   * Crea una nota de compra (borrador) por proveedor a partir de los faltantes elegidos: cada línea lleva
   * lo que falta en las notas de venta más las unidades extra para stock, con los costos del catálogo, y
   * queda ya ligada a esos faltantes. Si algo falla se borran los borradores ya creados.
   */
  async crearCompras(dto: CrearComprasDto, usuarioId: string) {
    const todas = dto.grupos.flatMap((g) => g.lineas.flatMap((l) => l.asignacionIds ?? []));
    if (new Set(todas).size !== todas.length) throw new BadRequestException("Un mismo faltante no puede ir en dos compras.");
    const todasSolicitud = dto.grupos.flatMap((g) => g.lineas.flatMap((l) => l.solicitudLineaIds ?? []));
    if (new Set(todasSolicitud).size !== todasSolicitud.length) throw new BadRequestException("Una misma línea de solicitud no puede ir en dos compras.");

    // Se validan todos los faltantes antes de crear nada.
    const cantidadPorAsignacion = new Map<string, number>();
    const cantidadPorSolicitud = new Map<string, number>();
    for (const grupo of dto.grupos) {
      for (const linea of grupo.lineas) {
        for (const asignacionId of linea.asignacionIds ?? []) {
          const a = await this.getProcura(asignacionId);
          if (a.compraDetalleId) throw new ConflictException("Uno de los faltantes ya está ligado a una compra: soltalo primero.");
          if (a.proformaDetalle.varianteId !== linea.varianteId) throw new BadRequestException("Un faltante no corresponde al producto de su línea.");
          cantidadPorAsignacion.set(asignacionId, a.cantidad);
        }
        for (const solicitudLineaId of linea.solicitudLineaIds ?? []) {
          const sl = await this.solicitudes.getLineaParaLigar(solicitudLineaId);
          if (sl.varianteId !== linea.varianteId) throw new BadRequestException("Una línea de solicitud no corresponde al producto de su línea.");
          cantidadPorSolicitud.set(solicitudLineaId, sl.cantidad);
        }
        const total =
          (linea.asignacionIds ?? []).reduce((n, id) => n + (cantidadPorAsignacion.get(id) ?? 0), 0) +
          (linea.solicitudLineaIds ?? []).reduce((n, id) => n + (cantidadPorSolicitud.get(id) ?? 0), 0) +
          (linea.cantidadExtra ?? 0);
        if (total <= 0) throw new BadRequestException("Cada línea de la compra necesita al menos una unidad.");
      }
    }

    const empresa =
      (await this.prisma.empresa.findFirst({ where: { activo: true, tipo: "CASA_MATRIZ" } })) ??
      (await this.prisma.empresa.findFirst({ where: { activo: true } }));
    if (!empresa) throw new BadRequestException("No hay una empresa activa para crear la compra.");

    const creadas: { id: string; codigo: string; proveedor: { id: string; nombre: string } | null; lineas: number; unidades: number }[] = [];
    try {
      for (const grupo of dto.grupos) {
        const compra = await this.proformas.create({ tipo: TipoProforma.COMPRA, empresaId: empresa.id, proveedorId: grupo.proveedorId }, usuarioId);
        let unidades = 0;
        for (const linea of grupo.lineas) {
          const cantidad =
            (linea.asignacionIds ?? []).reduce((n, id) => n + (cantidadPorAsignacion.get(id) ?? 0), 0) +
            (linea.solicitudLineaIds ?? []).reduce((n, id) => n + (cantidadPorSolicitud.get(id) ?? 0), 0) +
            (linea.cantidadExtra ?? 0);
          const variante = await this.prisma.productVariant.findUniqueOrThrow({
            where: { id: linea.varianteId },
            include: { product: { include: { category: true } } },
          });
          const cat = variante.product.category;
          const conLinea = await this.proformas.addDetalleCompra(compra.id, {
            varianteId: linea.varianteId,
            cantidad,
            precioCompra: Number(variante.purchasePrice),
            costoEnvio: Number(cat.shippingCost ?? 0),
            costoSeguridad: Number(cat.securityCost ?? 0),
            costoLogistica: Number(cat.logisticsCost ?? 0),
          });
          const detalle = conLinea.detalles.find((d) => d.varianteId === linea.varianteId);
          if (!detalle) throw new ConflictException("No se pudo crear la línea de compra.");
          for (const asignacionId of linea.asignacionIds ?? []) await this.vincular(asignacionId, detalle.id);
          for (const solicitudLineaId of linea.solicitudLineaIds ?? []) await this.solicitudes.vincularLinea(solicitudLineaId, detalle.id);
          unidades += cantidad;
        }
        const proveedor = await this.prisma.proveedor.findUnique({ where: { id: grupo.proveedorId }, select: { id: true, nombre: true } });
        creadas.push({ id: compra.id, codigo: compra.codigo, proveedor, lineas: grupo.lineas.length, unidades });
      }
    } catch (error) {
      for (const c of creadas) await this.proformas.remove(c.id).catch(() => undefined);
      throw error;
    }
    return creadas;
  }

  /** Suelta un faltante de su compra. Si el mismo faltante ya tiene otra fila libre, se funden en una sola. */
  async desvincular(asignacionId: string) {
    const asignacion = await this.prisma.proformaDetalleAsignacion.findUnique({ where: { id: asignacionId } });
    if (!asignacion) throw new NotFoundException("Línea de Procura no encontrada.");
    if (!asignacion.compraDetalleId) return this.prisma.proformaDetalleAsignacion.findUniqueOrThrow({ where: { id: asignacionId }, include: includeLinea });

    const compraDetalleId = asignacion.compraDetalleId;
    return this.prisma.$transaction(async (tx) => {
      const soltar = async () => {
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
      };
      const resultado = await soltar();
      // Lo soltado vuelve a ser stock en tránsito libre si la compra ya viaja en un envío despachado.
      await recalcularTransitoLinea(tx, compraDetalleId);
      return resultado;
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
