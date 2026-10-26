import { Injectable } from "@nestjs/common";
import { EstadoEnvio, EstadoProforma, NaturalezaMovimiento, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../../common/prisma.service";
import { CategoryService } from "../../../catalog/category/category.service";
import { QueryRegistrosDto } from "./dto/query-registros.dto";

// Solo transacciones reales (ni Borrador todavía, ni Anulada que no llegó a pasar) — mismo criterio
// que ya usa Seguimiento para "líneas con seguimiento habilitado".
const ESTADOS_REGISTRABLES: EstadoProforma[] = [EstadoProforma.APROBADA, EstadoProforma.COMPLETADA];
// Lo que no llegó a concretarse: cotizaciones sin aprobar y ventas/compras anuladas.
const ESTADOS_SIN_CONCRETAR: EstadoProforma[] = [EstadoProforma.BORRADOR, EstadoProforma.ANULADA];

const registroInclude = {
  proforma: {
    select: {
      id: true,
      codigo: true,
      estado: true,
      fecha: true,
      createdAt: true,
      creadoPor: { select: { id: true, nombre: true } },
      // Cuándo, quién y por qué se anuló (la última entrada ANULADA del historial) — para "Sin concretar".
      historial: {
        where: { estado: EstadoProforma.ANULADA },
        orderBy: { fecha: "desc" as const },
        take: 1,
        select: { fecha: true, nota: true, usuario: { select: { id: true, nombre: true } } },
      },
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

    // Entrega de una venta aprobada: pendiente = faltante (Procura) o reserva en tránsito sin llegar.
    const conPendiente: Prisma.ProformaWhereInput = {
      detalles: { some: { asignaciones: { some: { origen: { in: [OrigenAsignacion.PROCURA, OrigenAsignacion.EN_TRANSITO] }, cantidad: { gt: 0 } } } } },
    };

    const where: Prisma.ProformaDetalleWhereInput = {
      proveedorId: query.proveedorId,
      proforma: {
        tipo: query.tipo,
        ...(query.entrega ? { estado: EstadoProforma.APROBADA, ...(query.entrega === "LISTA" ? { NOT: conPendiente } : conPendiente) } : {}),
        codigo: query.codigo ? query.codigo.trim().toUpperCase() : undefined,
        clienteId: query.clienteId,
        ...(query.entrega
          ? {}
          : { estado: query.estado ? EstadoProforma[query.estado] : { in: query.sinConcretar ? ESTADOS_SIN_CONCRETAR : ESTADOS_REGISTRABLES } }),
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
          proforma: { select: { tipoCambioProf: true, estado: true } },
        },
      }),
    ]);

    // VENTA: el subtotal ya está en Bs. COMPRA: está en la moneda de la compra y se pasa a Bs con el
    // tipo de cambio propio de cada proforma (sin tipo de cambio no se puede convertir y no suma).
    let totalBs = 0;
    let piezas = 0;
    const proformas = new Set<string>();
    // Desglose por estado (para "Sin concretar": cuánto está en cotización y cuánto se anuló).
    const porEstado: Record<string, { totalBs: number; proformas: Set<string> }> = {};
    for (const l of todas) {
      proformas.add(l.proformaId);
      const subtotal = Number(l.subtotal);
      const subtotalEnBs = query.tipo === "VENTA" ? subtotal : l.proforma.tipoCambioProf ? subtotal * Number(l.proforma.tipoCambioProf) : 0;
      const grupo = (porEstado[l.proforma.estado] ??= { totalBs: 0, proformas: new Set<string>() });
      grupo.totalBs += subtotalEnBs;
      grupo.proformas.add(l.proformaId);
      totalBs += subtotalEnBs;
      // Una venta en ml cuenta frascos (presentaciones); una compra en ml, una unidad por línea.
      if (l.presentacionVenta?.cantidadMl) piezas += Math.round(l.cantidad / l.presentacionVenta.cantidadMl);
      else if (l.variante.unidad === "ML") piezas += 1;
      else piezas += l.cantidad;
    }
    const resumen = {
      totalBs: Math.round(totalBs * 100) / 100,
      piezas,
      proformas: proformas.size,
      porEstado: Object.fromEntries(
        Object.entries(porEstado).map(([estado, g]) => [estado, { totalBs: Math.round(g.totalBs * 100) / 100, proformas: g.proformas.size }]),
      ),
    };

    return { items: await this.conDatosDeProforma(items, query.tipo), total, page, pageSize, resumen };
  }

  /**
   * Suma a cada línea los datos de su proforma que se muestran en el encabezado del grupo: almacén y, según el
   * tipo, entrega/pagado/saldo (venta) o avance recogido/enviado/recibido (compra).
   */
  private async conDatosDeProforma<T extends { proforma: { id: string } }>(items: T[], tipo: TipoProforma) {
    const ids = Array.from(new Set(items.map((i) => i.proforma.id)));
    if (ids.length === 0) return items;
    const proformas = await this.prisma.proforma.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        almacen: { select: { id: true, nombre: true } },
        descuentoGeneral: true,
        estado: true,
        detalles: {
          select: {
            cantidad: true,
            subtotal: true,
            asignaciones: { select: { origen: true, cantidad: true } },
            recojoLineas: { select: { cantidad: true } },
            envioItems: { where: { envio: { estado: { not: EstadoEnvio.ANULADO } } }, select: { cantidad: true, cantidadRecibida: true, envio: { select: { estado: true } } } },
          },
        },
      },
    });
    const pagos = tipo === TipoProforma.VENTA
      ? await this.prisma.movimientoCartera.groupBy({ by: ["proformaId", "naturaleza"], where: { proformaId: { in: ids } }, _sum: { monto: true } })
      : [];

    const extra = new Map<string, Record<string, unknown>>();
    for (const p of proformas) {
      if (tipo === TipoProforma.VENTA) {
        let faltante = 0;
        let transito = 0;
        for (const d of p.detalles) {
          for (const a of d.asignaciones) {
            if (a.origen === OrigenAsignacion.PROCURA) faltante += a.cantidad;
            else if (a.origen === OrigenAsignacion.EN_TRANSITO) transito += a.cantidad;
          }
        }
        const total = p.detalles.reduce((n, d) => n + Number(d.subtotal), 0) - Number(p.descuentoGeneral);
        let pagado = 0;
        for (const g of pagos) {
          if (g.proformaId !== p.id) continue;
          const monto = Number(g._sum.monto ?? 0);
          pagado += g.naturaleza === NaturalezaMovimiento.INGRESO ? monto : -monto;
        }
        extra.set(p.id, {
          almacen: p.almacen,
          entrega: p.estado === EstadoProforma.APROBADA ? { faltante, transito } : null,
          total: Math.round(total * 100) / 100,
          pagado: Math.round(pagado * 100) / 100,
        });
      } else {
        let cantidad = 0;
        let recogido = 0;
        let enviado = 0;
        let recibido = 0;
        for (const d of p.detalles) {
          cantidad += d.cantidad;
          recogido += d.recojoLineas.reduce((n, r) => n + r.cantidad, 0);
          for (const i of d.envioItems) {
            recibido += i.cantidadRecibida;
            if (i.envio.estado !== EstadoEnvio.ARMANDO) enviado += i.cantidad;
          }
        }
        extra.set(p.id, { almacen: p.almacen, avance: { cantidad, recogido, enviado, recibido } });
      }
    }
    return items.map((i) => ({ ...i, proforma: { ...i.proforma, ...(extra.get(i.proforma.id) ?? {}) } }));
  }
}
