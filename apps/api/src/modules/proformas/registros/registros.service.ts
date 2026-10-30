import { Injectable } from "@nestjs/common";
import { EstadoEnvio, EstadoProforma, NaturalezaMovimiento, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../../common/prisma.service";
import { filtroProductoPorPalabras, palabrasBusqueda } from "../../../common/busqueda";
import { CategoryService } from "../../../catalog/category/category.service";
import { compraConEnlacesSelect, enviadasDeEnlace, estadoSegunCompra, recogidasDeEnlace, type EstadoPedidoDerivado } from "../recojo.util";
import { QueryRegistrosDto } from "./dto/query-registros.dto";

/** Estado de un producto (línea) dentro de su proforma, para verlo sin abrirla. */
export type EstadoLinea = "SALIO" | "EN_STOCK" | "RECIBIDO" | EstadoPedidoDerivado;

// De menos a más avanzado: en una venta con faltantes se muestra el que MÁS atrasado está (el que falta).
const ORDEN_AVANCE: EstadoPedidoDerivado[] = ["SIN_COMPRA", "EN_PREPARACION", "COMPRADO", "RECOGIDO", "EN_TRANSITO"];

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
  // Decants: la línea guarda ml; con esto el panel la muestra por presentación.
  presentacionVenta: { select: { cantidadMl: true } },
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
    const searchWords = palabrasBusqueda(query.search);

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
                AND: filtroProductoPorPalabras(searchWords),
              }
            : {}),
        },
      },
    };

    // Por proforma: la página son N proformas (las que tienen alguna línea que cumple el filtro) y de cada una se traen
    // TODAS sus líneas, para poder verla completa desplegada. Por línea: paginado clásico de líneas.
    let ordenProformas: string[] | undefined;
    let proformasVacias: Awaited<ReturnType<typeof this.prisma.proforma.findMany<{ select: typeof registroInclude.proforma.select }>>> = [];
    const paginaDeLineas = async () => {
      if (!query.porProforma) {
        return Promise.all([
          this.prisma.proformaDetalle.findMany({
            where,
            skip,
            take,
            // Las líneas de una misma proforma quedan contiguas (la pantalla las agrupa bajo su encabezado).
            orderBy: [{ proforma: { fecha: "desc" } }, { proformaId: "asc" }, { createdAt: "asc" }],
            include: registroInclude,
          }),
          this.prisma.proformaDetalle.count({ where }),
        ]);
      }
      // Con filtros de producto/proveedor solo cuentan las proformas con alguna línea que los cumpla; sin ellos entran también
      // las proformas todavía vacías (un borrador recién creado, sin productos), que si no quedarían invisibles.
      const hayFiltroDeLinea = Boolean(query.proveedorId || query.productId || query.brandId || categoryIds || searchWords.length > 0);
      const proformaWhere: Prisma.ProformaWhereInput = {
        ...(where.proforma as Prisma.ProformaWhereInput),
        ...(hayFiltroDeLinea ? { detalles: { some: { proveedorId: where.proveedorId, variante: where.variante } } } : {}),
      };
      const [pagina, totalProformas] = await Promise.all([
        this.prisma.proforma.findMany({ where: proformaWhere, orderBy: [{ fecha: "desc" }, { createdAt: "desc" }, { id: "asc" }], skip, take, select: { id: true } }),
        this.prisma.proforma.count({ where: proformaWhere }),
      ]);
      const orden = new Map(pagina.map((p, i) => [p.id, i]));
      const lineas = await this.prisma.proformaDetalle.findMany({
        where: { proformaId: { in: pagina.map((p) => p.id) } },
        orderBy: { createdAt: "asc" },
        include: registroInclude,
      });
      lineas.sort((a, b) => (orden.get(a.proformaId) ?? 0) - (orden.get(b.proformaId) ?? 0));
      ordenProformas = pagina.map((p) => p.id);
      const conLineas = new Set(lineas.map((l) => l.proformaId));
      const sinLineas = ordenProformas.filter((id) => !conLineas.has(id));
      if (sinLineas.length > 0) {
        proformasVacias = await this.prisma.proforma.findMany({ where: { id: { in: sinLineas } }, select: registroInclude.proforma.select });
      }
      return [lineas, totalProformas] as const;
    };

    const [[items, total], todas] = await Promise.all([
      paginaDeLineas(),
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
    // Las proformas todavía sin productos (borradores vacíos) también cuentan en el resumen (solo en modo por proforma y sin
    // filtros de producto/proveedor, que son los que las excluyen).
    const sinFiltroDeLinea = !(query.proveedorId || query.productId || query.brandId || categoryIds || searchWords.length > 0);
    let proformasContadas = proformas.size;
    if (query.porProforma && sinFiltroDeLinea) {
      const vacias = await this.prisma.proforma.groupBy({
        by: ["estado"],
        where: { ...(where.proforma as Prisma.ProformaWhereInput), detalles: { none: {} } },
        _count: { _all: true },
      });
      for (const v of vacias) {
        const grupo = (porEstado[v.estado] ??= { totalBs: 0, proformas: new Set<string>() });
        for (let i = 0; i < v._count._all; i++) grupo.proformas.add(`vacia-${v.estado}-${i}`);
        proformasContadas += v._count._all;
      }
    }
    const resumen = {
      totalBs: Math.round(totalBs * 100) / 100,
      piezas,
      proformas: proformasContadas,
      porEstado: Object.fromEntries(
        Object.entries(porEstado).map(([estado, g]) => [estado, { totalBs: Math.round(g.totalBs * 100) / 100, proformas: g.proformas.size }]),
      ),
    };

    const conProforma = await this.conDatosDeProforma(items, query.tipo);
    // En modo por proforma: el orden de las proformas de la página y las que todavía no tienen productos.
    return { items: await this.conEstadoDeLinea(conProforma, query.tipo), total, page, pageSize, resumen, ordenProformas, proformasVacias };
  }

  /**
   * Suma a cada línea su estado: en una venta, si salió del stock, está en stock o falta (y cómo va su compra: sin compra,
   * comprado, recogido o enviado); en una compra, comprado, recogido, enviado o recibido. Borradores y anuladas no tienen.
   */
  private async conEstadoDeLinea<T extends { id: string; cantidad: number; proforma: { estado: EstadoProforma } }>(items: T[], tipo: TipoProforma) {
    const ids = items.map((i) => i.id);
    if (ids.length === 0) return items;
    const estadoDe = new Map<string, { estado: EstadoLinea; listas: number; cantidad: number }>();

    if (tipo === TipoProforma.VENTA) {
      const asignaciones = await this.prisma.proformaDetalleAsignacion.findMany({
        where: { proformaDetalleId: { in: ids }, cantidad: { gt: 0 } },
        select: {
          id: true,
          proformaDetalleId: true,
          origen: true,
          cantidad: true,
          compraDetalle: { select: { proforma: { select: { estado: true } }, ...compraConEnlacesSelect } },
        },
      });
      for (const item of items) {
        if (item.proforma.estado === EstadoProforma.COMPLETADA) {
          estadoDe.set(item.id, { estado: "SALIO", listas: item.cantidad, cantidad: item.cantidad });
          continue;
        }
        if (item.proforma.estado !== EstadoProforma.APROBADA) continue;
        const propias = asignaciones.filter((a) => a.proformaDetalleId === item.id);
        const listas = propias.filter((a) => a.origen === OrigenAsignacion.STOCK).reduce((n, a) => n + a.cantidad, 0);
        const estados: EstadoPedidoDerivado[] = [];
        for (const a of propias) {
          if (a.origen === OrigenAsignacion.EN_TRANSITO) estados.push("EN_TRANSITO");
          else if (a.origen === OrigenAsignacion.PROCURA) {
            const recogidas = a.compraDetalle ? recogidasDeEnlace(a.compraDetalle, a.id) : 0;
            const enviadas = a.compraDetalle ? enviadasDeEnlace(a.compraDetalle, a.id) : 0;
            estados.push(estadoSegunCompra(a.compraDetalle?.proforma.estado, a.cantidad, recogidas, enviadas));
          }
        }
        const peor = estados.sort((x, y) => ORDEN_AVANCE.indexOf(x) - ORDEN_AVANCE.indexOf(y))[0];
        estadoDe.set(item.id, { estado: peor ?? "EN_STOCK", listas, cantidad: item.cantidad });
      }
    } else {
      const lineas = await this.prisma.proformaDetalle.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          recojoLineas: { select: { cantidad: true } },
          envioItems: { where: { envio: { estado: { not: EstadoEnvio.ANULADO } } }, select: { cantidad: true, cantidadRecibida: true, envio: { select: { estado: true } } } },
        },
      });
      const porId = new Map(lineas.map((l) => [l.id, l]));
      for (const item of items) {
        if (item.proforma.estado === EstadoProforma.COMPLETADA) {
          estadoDe.set(item.id, { estado: "RECIBIDO", listas: item.cantidad, cantidad: item.cantidad });
          continue;
        }
        if (item.proforma.estado !== EstadoProforma.APROBADA) continue;
        const l = porId.get(item.id);
        const recogido = l?.recojoLineas.reduce((n, r) => n + r.cantidad, 0) ?? 0;
        const enviado = l?.envioItems.filter((i) => i.envio.estado !== EstadoEnvio.ARMANDO).reduce((n, i) => n + i.cantidad, 0) ?? 0;
        const recibido = l?.envioItems.reduce((n, i) => n + i.cantidadRecibida, 0) ?? 0;
        // El estado es el de las unidades que todavía faltan: recibido solo cuando llegó todo.
        const estado: EstadoLinea = recibido >= item.cantidad ? "RECIBIDO" : enviado >= item.cantidad ? "EN_TRANSITO" : recogido >= item.cantidad ? "RECOGIDO" : "COMPRADO";
        estadoDe.set(item.id, { estado, listas: recibido, cantidad: item.cantidad });
      }
    }
    return items.map((i) => ({ ...i, estadoLinea: estadoDe.get(i.id) ?? null }));
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
            asignaciones: {
              select: {
                id: true,
                origen: true,
                cantidad: true,
                compraDetalle: { select: { proforma: { select: { estado: true } }, ...compraConEnlacesSelect } },
              },
            },
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
        // Estado de lo que falta según su compra: se muestra el MÁS atrasado (el que falta), no solo "con faltante".
        const estados: EstadoPedidoDerivado[] = [];
        for (const d of p.detalles) {
          for (const a of d.asignaciones) {
            if (a.cantidad <= 0) continue;
            if (a.origen === OrigenAsignacion.PROCURA) {
              faltante += a.cantidad;
              const recogidas = a.compraDetalle ? recogidasDeEnlace(a.compraDetalle, a.id) : 0;
              const enviadas = a.compraDetalle ? enviadasDeEnlace(a.compraDetalle, a.id) : 0;
              estados.push(estadoSegunCompra(a.compraDetalle?.proforma.estado, a.cantidad, recogidas, enviadas));
            } else if (a.origen === OrigenAsignacion.EN_TRANSITO) {
              transito += a.cantidad;
              estados.push("EN_TRANSITO");
            }
          }
        }
        const estadoEntrega = estados.sort((x, y) => ORDEN_AVANCE.indexOf(x) - ORDEN_AVANCE.indexOf(y))[0] ?? null;
        const total = p.detalles.reduce((n, d) => n + Number(d.subtotal), 0) - Number(p.descuentoGeneral);
        let pagado = 0;
        for (const g of pagos) {
          if (g.proformaId !== p.id) continue;
          const monto = Number(g._sum.monto ?? 0);
          pagado += g.naturaleza === NaturalezaMovimiento.INGRESO ? monto : -monto;
        }
        extra.set(p.id, {
          almacen: p.almacen,
          entrega: p.estado === EstadoProforma.APROBADA ? { faltante, transito, estado: estadoEntrega } : null,
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
