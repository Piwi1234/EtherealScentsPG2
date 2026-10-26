import { Injectable } from "@nestjs/common";
import { EstadoEnvio, EstadoProforma, EstadoSolicitudStock, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
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
      OR: [{ cantidadFisica: { gt: 0 } }, { cantidadEnTransito: { gt: 0 } }],
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

  /**
   * Existencias por PRODUCTO (una fila por variante, sumando los almacenes — o solo el elegido): físico, reservado,
   * en tránsito, disponible y valor en Bs, más los indicadores de todo lo filtrado.
   */
  async resumen(query: {
    page?: string;
    pageSize?: string;
    almacenId?: string;
    search?: string;
    categoryId?: string;
    brandId?: string;
    estado?: "SIN_DISPONIBLE" | "CON_DISPONIBLE";
  }) {
    const { page, pageSize, skip, take } = getPagination({ page: query.page ?? "1", pageSize: query.pageSize ?? "20" });
    const categoryIds = query.categoryId ? await this.collectCategoryIds(query.categoryId) : undefined;

    const where: Prisma.StockWhereInput = {
      almacenId: query.almacenId,
      OR: [{ cantidadFisica: { gt: 0 } }, { cantidadEnTransito: { gt: 0 } }, { cantidadReservada: { gt: 0 } }],
      variante: {
        product: { categoryId: categoryIds ? { in: categoryIds } : undefined, brandId: query.brandId },
        ...(query.search
          ? {
              OR: [
                { variantCode: { contains: query.search, mode: "insensitive" } },
                { product: { name: { contains: query.search, mode: "insensitive" } } },
                { product: { productCode: { contains: query.search, mode: "insensitive" } } },
                { product: { brand: { name: { contains: query.search, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
    };

    const grupos = await this.prisma.stock.groupBy({
      by: ["varianteId"],
      where,
      _sum: { cantidadFisica: true, cantidadReservada: true, cantidadEnTransito: true, cantidadReservadaTransito: true },
      _count: { almacenId: true },
    });
    const filas = grupos
      .map((g) => {
        const fisica = g._sum.cantidadFisica ?? 0;
        const reservada = g._sum.cantidadReservada ?? 0;
        return {
          varianteId: g.varianteId,
          almacenes: g._count.almacenId,
          cantidadFisica: fisica,
          cantidadReservada: reservada,
          cantidadEnTransito: g._sum.cantidadEnTransito ?? 0,
          cantidadReservadaTransito: g._sum.cantidadReservadaTransito ?? 0,
          disponible: fisica - reservada,
        };
      })
      .filter((f) => (query.estado === "SIN_DISPONIBLE" ? f.disponible <= 0 : query.estado === "CON_DISPONIBLE" ? f.disponible > 0 : true));

    // Valor en Bs de los lotes con saldo: costo (en la moneda de la compra) × tipo de cambio de ESA compra.
    const ids = filas.map((f) => f.varianteId);
    const valores = ids.length
      ? await this.prisma.$queryRaw<{ varianteId: string; valor: number | null }[]>`
          SELECT l."variante_id" AS "varianteId", SUM(l."cantidad_disponible" * l."costo_unitario" * COALESCE(p."tipo_cambio_prof", 0))::float AS "valor"
          FROM "lotes_compra" l
          JOIN "proforma_detalles" d ON d."id" = l."proforma_detalle_id"
          JOIN "proformas" p ON p."id" = d."proforma_id"
          WHERE l."variante_id" = ANY(${ids}::uuid[]) AND l."cantidad_disponible" > 0
            ${query.almacenId ? Prisma.sql`AND l."almacen_id" = ${query.almacenId}::uuid` : Prisma.empty}
          GROUP BY l."variante_id"
        `
      : [];
    const valorPorVariante = new Map(valores.map((v) => [v.varianteId, Math.round((v.valor ?? 0) * 100) / 100]));

    const indicadores = {
      productos: filas.length,
      unidadesFisicas: filas.reduce((n, f) => n + f.cantidadFisica, 0),
      reservadas: filas.reduce((n, f) => n + f.cantidadReservada, 0),
      enTransito: filas.reduce((n, f) => n + f.cantidadEnTransito, 0),
      sinDisponible: filas.filter((f) => f.disponible <= 0).length,
      valorBs: Math.round(Array.from(valorPorVariante.values()).reduce((n, v) => n + v, 0) * 100) / 100,
    };

    const variantes = await this.prisma.productVariant.findMany({ where: { id: { in: ids } }, select: stockInclude.variante.select });
    const porId = new Map(variantes.map((v) => [v.id, v]));
    const ordenadas = filas
      .map((f) => ({ ...f, variante: porId.get(f.varianteId)!, valorBs: valorPorVariante.get(f.varianteId) ?? 0 }))
      .filter((f) => f.variante)
      .sort(
        (a, b) =>
          (a.variante.product.brand?.name ?? "").localeCompare(b.variante.product.brand?.name ?? "") ||
          a.variante.product.name.localeCompare(b.variante.product.name),
      );

    return { items: ordenadas.slice(skip, skip + take), total: ordenadas.length, page, pageSize, indicadores };
  }

  /**
   * Todo lo que hay detrás de un producto: dónde está (por almacén), de qué lotes y a qué costo, para qué ventas está
   * reservado, qué faltantes de ventas lo esperan, qué compras vienen en camino y qué solicitudes de stock lo piden.
   */
  async detalleVariante(varianteId: string) {
    const ventaAprobada = { tipo: TipoProforma.VENTA, estado: EstadoProforma.APROBADA };
    const ventaSelect = { select: { id: true, codigo: true, fecha: true, cliente: { select: { id: true, nombre: true } } } };
    const [almacenes, lotes, reservas, faltantes, compras, solicitudes] = await Promise.all([
      this.prisma.stock.findMany({ where: { varianteId }, include: stockInclude, orderBy: { almacen: { nombre: "asc" } } }),
      this.prisma.loteCompra.findMany({
        where: { varianteId, cantidadDisponible: { gt: 0 } },
        orderBy: { fecha: "asc" },
        select: {
          id: true,
          fecha: true,
          costoUnitario: true,
          cantidadInicial: true,
          cantidadDisponible: true,
          almacen: { select: { id: true, nombre: true } },
          proformaDetalle: { select: { proveedor: { select: { id: true, nombre: true } }, proforma: { select: { id: true, codigo: true, tipoCambioProf: true } } } },
        },
      }),
      this.prisma.proformaDetalleAsignacion.findMany({
        where: {
          origen: { in: [OrigenAsignacion.STOCK, OrigenAsignacion.EN_TRANSITO] },
          cantidad: { gt: 0 },
          proformaDetalle: { varianteId, proforma: ventaAprobada },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, cantidad: true, origen: true, almacen: { select: { id: true, nombre: true } }, proformaDetalle: { select: { proforma: ventaSelect } } },
      }),
      this.prisma.proformaDetalleAsignacion.findMany({
        where: { origen: OrigenAsignacion.PROCURA, cantidad: { gt: 0 }, proformaDetalle: { varianteId, proforma: ventaAprobada } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          cantidad: true,
          compraDetalle: { select: { proforma: { select: { id: true, codigo: true } } } },
          proformaDetalle: { select: { proforma: ventaSelect } },
        },
      }),
      this.prisma.proformaDetalle.findMany({
        where: { varianteId, proforma: { tipo: TipoProforma.COMPRA, estado: EstadoProforma.APROBADA } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          cantidad: true,
          proveedor: { select: { id: true, nombre: true } },
          proforma: { select: { id: true, codigo: true, almacen: { select: { id: true, nombre: true } } } },
          recojoLineas: { select: { cantidad: true } },
          envioItems: { where: { envio: { estado: { not: EstadoEnvio.ANULADO } } }, select: { cantidad: true, cantidadRecibida: true, envio: { select: { estado: true } } } },
        },
      }),
      this.prisma.solicitudStockLinea.findMany({
        where: { varianteId, solicitud: { estado: EstadoSolicitudStock.ABIERTA } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          cantidad: true,
          cantidadRecibida: true,
          solicitud: { select: { id: true, codigo: true } },
          compraDetalle: { select: { proforma: { select: { id: true, codigo: true } } } },
        },
      }),
    ]);

    const lotesBs = lotes.map((l) => {
      const tc = l.proformaDetalle.proforma.tipoCambioProf ? Number(l.proformaDetalle.proforma.tipoCambioProf) : null;
      const costoUsd = Number(l.costoUnitario);
      return { ...l, costoUsd, costoBs: tc ? Math.round(costoUsd * tc * 100) / 100 : null };
    });
    const unidadesConCosto = lotesBs.filter((l) => l.costoBs !== null).reduce((n, l) => n + l.cantidadDisponible, 0);
    const valorBs = lotesBs.reduce((n, l) => n + (l.costoBs ?? 0) * l.cantidadDisponible, 0);

    const enCamino = compras
      .map((c) => {
        const recogido = c.recojoLineas.reduce((n, r) => n + r.cantidad, 0);
        const enviado = c.envioItems.filter((i) => i.envio.estado !== EstadoEnvio.ARMANDO).reduce((n, i) => n + i.cantidad, 0);
        const recibido = c.envioItems.reduce((n, i) => n + i.cantidadRecibida, 0);
        return { id: c.id, compra: c.proforma, proveedor: c.proveedor, cantidad: c.cantidad, recogido, enviado, recibido, pendiente: c.cantidad - recibido };
      })
      .filter((c) => c.pendiente > 0);

    return {
      almacenes,
      lotes: lotesBs,
      costoPromedioBs: unidadesConCosto > 0 ? Math.round((valorBs / unidadesConCosto) * 100) / 100 : null,
      valorBs: Math.round(valorBs * 100) / 100,
      reservas,
      faltantes,
      enCamino,
      solicitudes: solicitudes.filter((s) => s.cantidad - s.cantidadRecibida > 0),
    };
  }
}
