import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoEnvio, EstadoProforma, Prisma, TipoProforma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../../common/prisma.service";
import { rethrowPrismaError } from "../../../common/prisma-errors";
import { generateUniqueEntityCode } from "../../../catalog/entity-code";
import { CategoryService } from "../../../catalog/category/category.service";
import { ProformaHistorialService } from "../proforma-historial.service";
import { lockStockRows, stockKey } from "../stock-lock.util";
import { resolverProcuraPendiente } from "../procura.util";
import { recalcularTransitoLinea } from "../transito.util";
import { CreateEnvioDto, CreateRecepcionDto, EnvioItemDto, QueryEnvioDto, UpdateEnvioDto, UpdateEnvioItemDto } from "./dto/envio.dto";

const varianteInclude = {
  product: { include: { brand: true } },
  options: { include: { optionValue: { include: { attribute: true } } } },
} satisfies Prisma.ProductVariantInclude;

const itemInclude = {
  compraDetalle: {
    select: {
      id: true,
      cantidad: true,
      proveedor: { select: { id: true, nombre: true } },
      proforma: { select: { id: true, codigo: true, estado: true } },
      variante: { include: varianteInclude },
      // Costos estimados de la compra: se corrigen con los reales al recibir (el precio de compra no se edita).
      precioCompra: true,
      costoEnvio: true,
      costoSeguridad: true,
      costoLogistica: true,
    },
  },
} satisfies Prisma.EnvioItemInclude;

const envioInclude = {
  almacenDestino: true,
  creadoPor: { select: { id: true, nombre: true } },
  // Alfabético por producto (y por variante dentro del mismo producto).
  items: {
    include: itemInclude,
    orderBy: [
      { compraDetalle: { variante: { product: { name: "asc" as const } } } },
      { compraDetalle: { variante: { variantCode: "asc" as const } } },
    ],
  },
  recepciones: {
    orderBy: { fecha: "desc" as const },
    include: {
      creadoPor: { select: { id: true, nombre: true } },
      items: { include: { varianteRecibida: { include: varianteInclude }, envioItem: { select: { id: true, compraDetalleId: true } } } },
    },
  },
} satisfies Prisma.EnvioInclude;

/**
 * Un envío agrupa PRODUCTOS ya recogidos (con su cantidad) de una o varias compras y proveedores que viajan
 * juntos a un almacén. Una línea de compra puede repartirse en varios envíos y la recepción puede ser parcial:
 * lo que no llegó sigue "en camino" en el envío. Es el ÚNICO camino para recibir mercadería: cada recepción crea
 * los lotes y el stock con lo que realmente llegó, y una compra se completa cuando todas sus líneas llegaron.
 */
@Injectable()
export class EnviosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historial: ProformaHistorialService,
    private readonly categories: CategoryService,
  ) {}

  async findAll(query: QueryEnvioDto) {
    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });
    // Filtros por contenido: producto o marca (cada palabra exige su match), categoría y proveedor miran los productos del envío.
    const palabras = query.search?.trim() ? query.search.trim().split(/\s+/).filter(Boolean) : [];
    const categoryIds = query.categoryId ? await this.categories.getDescendantIds(query.categoryId) : undefined;
    const filtroProducto: Prisma.ProductWhereInput = {
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
    };
    const hayFiltroDeContenido = Boolean(query.proveedorId || categoryIds || palabras.length > 0);
    const where: Prisma.EnvioWhereInput = {
      estado: query.estado,
      almacenDestinoId: query.almacenId,
      ...(hayFiltroDeContenido
        ? { items: { some: { compraDetalle: { proveedorId: query.proveedorId, variante: { product: filtroProducto } } } } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.envio.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        // Todo el contenido del envío, para mostrarlo desplegado en la lista (productos en orden alfabético).
        include: {
          almacenDestino: true,
          creadoPor: { select: { id: true, nombre: true } },
          items: {
            include: itemInclude,
            orderBy: [
              { compraDetalle: { variante: { product: { name: "asc" as const } } } },
              { compraDetalle: { variante: { variantCode: "asc" as const } } },
            ],
          },
        },
      }),
      this.prisma.envio.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const envio = await this.prisma.envio.findUnique({ where: { id }, include: envioInclude });
    if (!envio) throw new NotFoundException("Envío no encontrado.");
    return envio;
  }

  /** Productos recogidos que todavía no están (del todo) en un envío: lo que se puede sumar a uno. */
  async findDisponibles() {
    const lineas = await this.prisma.proformaDetalle.findMany({
      where: { proforma: { tipo: TipoProforma.COMPRA, estado: EstadoProforma.APROBADA }, recojoLineas: { some: {} } },
      orderBy: [{ variante: { product: { name: "asc" } } }, { proforma: { createdAt: "asc" } }],
      select: {
        id: true,
        cantidad: true,
        proveedor: { select: { id: true, nombre: true } },
        proforma: { select: { id: true, codigo: true, fecha: true, almacenId: true, proveedor: { select: { id: true, nombre: true } } } },
        variante: { include: varianteInclude },
        recojoLineas: { select: { cantidad: true } },
        envioItems: { where: { envio: { estado: { not: EstadoEnvio.ANULADO } } }, select: { cantidad: true } },
      },
    });
    return lineas
      .map(({ recojoLineas, envioItems, ...l }) => {
        const recogido = recojoLineas.reduce((n, r) => n + r.cantidad, 0);
        const enEnvios = envioItems.reduce((n, r) => n + r.cantidad, 0);
        return { ...l, recogido, disponible: recogido - enEnvios };
      })
      .filter((l) => l.disponible > 0);
  }

  private async assertAlmacenExists(id: string) {
    const almacen = await this.prisma.almacen.findUnique({ where: { id } });
    if (!almacen) throw new BadRequestException(`almacenDestinoId inválido: ${id}`);
  }

  private assertEstado(envio: { estado: EstadoEnvio }, permitidos: EstadoEnvio[], accion: string) {
    if (!permitidos.includes(envio.estado)) {
      throw new ConflictException(`No se puede ${accion}: el envío está en estado ${envio.estado}.`);
    }
  }

  private async lockEnvio(tx: Prisma.TransactionClient, id: string) {
    await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
    const rows = await tx.$queryRaw<{ estado: EstadoEnvio; almacenDestinoId: string }[]>`
      SELECT "estado", "almacen_destino_id" AS "almacenDestinoId" FROM "envios" WHERE "id" = ${id}::uuid FOR UPDATE
    `;
    if (!rows[0]) throw new NotFoundException("Envío no encontrado.");
    return rows[0];
  }

  /**
   * Unidades de una línea de compra que se pueden sumar a un envío: lo recogido menos lo que ya está en envíos
   * vigentes. Bloquea la compra para que dos envíos no tomen las mismas unidades a la vez.
   */
  private async disponibleDeLinea(tx: Prisma.TransactionClient, compraDetalleId: string, ignorarItemId?: string) {
    const linea = await tx.proformaDetalle.findUnique({
      where: { id: compraDetalleId },
      select: {
        proformaId: true,
        proforma: { select: { tipo: true, estado: true, codigo: true, almacenId: true } },
        recojoLineas: { select: { cantidad: true } },
        envioItems: { where: { envio: { estado: { not: EstadoEnvio.ANULADO } } }, select: { id: true, cantidad: true } },
      },
    });
    if (!linea) throw new BadRequestException(`Línea de compra inválida: ${compraDetalleId}`);
    if (linea.proforma.tipo !== TipoProforma.COMPRA) throw new BadRequestException(`${linea.proforma.codigo} no es una proforma de compra.`);
    if (linea.proforma.estado !== EstadoProforma.APROBADA) {
      throw new ConflictException(`${linea.proforma.codigo} tiene que estar APROBADA para enviar sus productos (está ${linea.proforma.estado}).`);
    }
    await tx.$queryRaw`SELECT "id" FROM "proformas" WHERE "id" = ${linea.proformaId}::uuid FOR UPDATE`;
    const recogido = linea.recojoLineas.reduce((n, r) => n + r.cantidad, 0);
    const enEnvios = linea.envioItems.filter((i) => i.id !== ignorarItemId).reduce((n, i) => n + i.cantidad, 0);
    return { disponible: recogido - enEnvios, codigo: linea.proforma.codigo, almacenId: linea.proforma.almacenId };
  }

  private generateCodigo() {
    return generateUniqueEntityCode(async (code) => {
      const existing = await this.prisma.envio.findUnique({ where: { codigo: code }, select: { id: true } });
      return Boolean(existing);
    });
  }

  private async sumarItem(tx: Prisma.TransactionClient, envioId: string, item: EnvioItemDto) {
    const { disponible, codigo, almacenId } = await this.disponibleDeLinea(tx, item.compraDetalleId);
    const envio = await tx.envio.findUniqueOrThrow({ where: { id: envioId }, select: { almacenDestinoId: true, almacenDestino: { select: { nombre: true } } } });
    if (almacenId && almacenId !== envio.almacenDestinoId) {
      throw new ConflictException(`${codigo} tiene otro almacén destino distinto al del envío (${envio.almacenDestino.nombre}). Cambiá el almacén de la compra o el del envío.`);
    }
    if (item.cantidad > disponible) {
      throw new ConflictException(`De ${codigo} solo hay ${Math.max(0, disponible)} unidad(es) recogida(s) sin enviar y quisiste enviar ${item.cantidad}.`);
    }
    const existente = await tx.envioItem.findUnique({ where: { envioId_compraDetalleId: { envioId, compraDetalleId: item.compraDetalleId } } });
    if (existente) {
      await tx.envioItem.update({ where: { id: existente.id }, data: { cantidad: { increment: item.cantidad } } });
    } else {
      await tx.envioItem.create({ data: { envioId, compraDetalleId: item.compraDetalleId, cantidad: item.cantidad } });
    }
  }

  async create(dto: CreateEnvioDto, usuarioId: string) {
    await this.assertAlmacenExists(dto.almacenDestinoId);
    const codigo = await this.generateCodigo();
    try {
      const envio = await this.prisma.$transaction(
        async (tx) => {
          const creado = await tx.envio.create({
            data: { codigo, almacenDestinoId: dto.almacenDestinoId, nota: dto.nota, creadoPorId: usuarioId },
          });
          for (const item of dto.items ?? []) await this.sumarItem(tx, creado.id, item);
          return creado;
        },
        { timeout: 15000, maxWait: 5000 },
      );
      return this.findOne(envio.id);
    } catch (error) {
      rethrowPrismaError(error, "Envío");
    }
  }

  /** La nota al pie se puede editar en cualquier estado (es solo texto del PDF). */
  async updateNotaPie(id: string, notaPie: string | undefined) {
    const envio = await this.prisma.envio.findUnique({ where: { id }, select: { id: true } });
    if (!envio) throw new NotFoundException("Envío no encontrado.");
    await this.prisma.envio.update({ where: { id }, data: { notaPie: notaPie?.trim() || null } });
    return this.findOne(id);
  }

  async update(id: string, dto: UpdateEnvioDto) {
    const envio = await this.findOne(id);
    this.assertEstado(envio, [EstadoEnvio.ARMANDO], "editar");
    if (dto.almacenDestinoId) await this.assertAlmacenExists(dto.almacenDestinoId);
    await this.prisma.envio.update({ where: { id }, data: { almacenDestinoId: dto.almacenDestinoId, nota: dto.nota } });
    return this.findOne(id);
  }

  async agregarItem(id: string, dto: EnvioItemDto) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const lock = await this.lockEnvio(tx, id);
          this.assertEstado(lock, [EstadoEnvio.ARMANDO], "agregar productos");
          await this.sumarItem(tx, id, dto);
        },
        { timeout: 15000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Envío");
    }
    return this.findOne(id);
  }

  async updateItem(id: string, itemId: string, dto: UpdateEnvioItemDto) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const lock = await this.lockEnvio(tx, id);
          this.assertEstado(lock, [EstadoEnvio.ARMANDO], "editar productos");
          const item = await tx.envioItem.findFirst({ where: { id: itemId, envioId: id } });
          if (!item) throw new NotFoundException("Ese producto no está en este envío.");
          const { disponible, codigo } = await this.disponibleDeLinea(tx, item.compraDetalleId, itemId);
          if (dto.cantidad > disponible) {
            throw new ConflictException(`De ${codigo} solo hay ${Math.max(0, disponible)} unidad(es) recogida(s) para este envío y quisiste ${dto.cantidad}.`);
          }
          await tx.envioItem.update({ where: { id: itemId }, data: { cantidad: dto.cantidad } });
        },
        { timeout: 15000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Envío");
    }
    return this.findOne(id);
  }

  async quitarItem(id: string, itemId: string) {
    const envio = await this.findOne(id);
    this.assertEstado(envio, [EstadoEnvio.ARMANDO], "quitar productos");
    if (!envio.items.some((i) => i.id === itemId)) throw new NotFoundException("Ese producto no está en este envío.");
    await this.prisma.envioItem.delete({ where: { id: itemId } });
    return this.findOne(id);
  }

  async marcarEnTransito(id: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const lock = await this.lockEnvio(tx, id);
          this.assertEstado(lock, [EstadoEnvio.ARMANDO], "marcar en tránsito");
          const items = await tx.envioItem.findMany({
            where: { envioId: id },
            select: { compraDetalleId: true, compraDetalle: { select: { varianteId: true, proforma: { select: { codigo: true, estado: true } } } } },
          });
          if (items.length === 0) throw new ConflictException("El envío no tiene productos.");
          for (const i of items) {
            if (i.compraDetalle.proforma.estado !== EstadoProforma.APROBADA) {
              throw new ConflictException(`${i.compraDetalle.proforma.codigo} ya no está aprobada: sacá sus productos del envío.`);
            }
          }

          // El stock en tránsito ya se contó al recoger: salir en un envío no lo cambia.
          await tx.envio.update({ where: { id }, data: { estado: EstadoEnvio.EN_TRANSITO, fechaEnvio: new Date() } });
        },
        { timeout: 20000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Envío");
    }
    return this.findOne(id);
  }

  async anular(id: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const lock = await this.lockEnvio(tx, id);
          this.assertEstado(lock, [EstadoEnvio.ARMANDO, EstadoEnvio.EN_TRANSITO], "anular");
          if ((await tx.envioRecepcion.count({ where: { envioId: id } })) > 0) {
            throw new ConflictException("El envío ya recibió mercadería: no se puede anular. Cerralo para dar por no llegado lo que falta.");
          }

          await tx.envio.update({ where: { id }, data: { estado: EstadoEnvio.ANULADO } });
        },
        { timeout: 20000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Envío");
    }
    return this.findOne(id);
  }

  /**
   * Registra lo que llegó (parcial o total): por cada ítem crea el LoteCompra (a nombre de la variante que
   * REALMENTE llegó, con el costo de la línea de compra) y suma stock físico en el almacén destino; después
   * reparte el faltante de ventas ligadas a esa compra, completa las compras cuyas líneas ya llegaron todas y
   * deja el envío RECIBIDO cuando no queda nada en camino. Una sola transacción, con las filas de stock
   * bloqueadas antes de tocar lotes.
   */
  async recibir(id: string, dto: CreateRecepcionDto, usuarioId: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const lock = await this.lockEnvio(tx, id);
          this.assertEstado(lock, [EstadoEnvio.ARMANDO, EstadoEnvio.EN_TRANSITO], "registrar la recepción");
          const almacenId = lock.almacenDestinoId;

          const envio = await tx.envio.findUniqueOrThrow({
            where: { id },
            include: {
              items: {
                include: {
                  compraDetalle: { include: { variante: { include: { product: true } }, asignacionesCubiertas: { select: { cantidad: true } } } },
                },
              },
            },
          });
          const porId = new Map(envio.items.map((i) => [i.id, i]));

          // Un mismo ítem puede venir repetido (p. ej. parte llegó correcta y parte "otro producto"): se valida el total.
          const totalPorItem = new Map<string, number>();
          for (const l of dto.items) {
            if (!porId.has(l.envioItemId)) throw new BadRequestException("Uno de los productos no pertenece a este envío.");
            totalPorItem.set(l.envioItemId, (totalPorItem.get(l.envioItemId) ?? 0) + l.cantidad);
          }
          for (const [itemId, total] of totalPorItem) {
            const item = porId.get(itemId)!;
            const falta = item.cantidad - item.cantidadRecibida;
            if (total > falta) {
              throw new ConflictException(`De ${item.compraDetalle.variante.product.name} solo faltan ${falta} unidad(es) por llegar y registraste ${total}.`);
            }
          }
          const otrasVariantes = Array.from(new Set(dto.items.map((l) => l.varianteRecibidaId).filter((v): v is string => Boolean(v))));
          if (otrasVariantes.length > 0) {
            const encontradas = await tx.productVariant.count({ where: { id: { in: otrasVariantes } } });
            if (encontradas !== otrasVariantes.length) throw new BadRequestException("Alguna de las variantes recibidas no existe.");
          }

          const varianteRecibidaDe = (l: { envioItemId: string; varianteRecibidaId?: string }) =>
            l.varianteRecibidaId ?? porId.get(l.envioItemId)!.compraDetalle.varianteId;
          const variantes = new Set<string>([
            ...dto.items.map(varianteRecibidaDe),
            ...envio.items.map((i) => i.compraDetalle.varianteId),
          ]);
          const pares = Array.from(variantes).map((varianteId) => ({ varianteId, almacenId }));
          const stockPorPar = await lockStockRows(tx, pares);

          // Faltantes de ventas ligados a cada línea ANTES de resolver: la diferencia es lo que consumieron.
          const ligadasAntes = new Map<string, number>();
          for (const i of envio.items) {
            ligadasAntes.set(i.compraDetalleId, i.compraDetalle.asignacionesCubiertas.reduce((n, a) => n + a.cantidad, 0));
          }

          const recepcion = await tx.envioRecepcion.create({ data: { envioId: id, nota: dto.nota?.trim() || undefined, creadoPorId: usuarioId } });
          const llegoEsperado = new Map<string, number>(); // compraDetalleId → unidades de la variante esperada
          const diferencias: string[] = [];
          for (const l of dto.items) {
            const item = porId.get(l.envioItemId)!;
            const d = item.compraDetalle;
            const varianteRecibidaId = varianteRecibidaDe(l);
            // El precio de compra no se edita; los costos de envío, seguridad y logística son los reales de esta recepción
            // (por defecto, los estimados de la compra).
            const costoEnvio = l.costoEnvio ?? Number(d.costoEnvio ?? 0);
            const costoSeguridad = l.costoSeguridad ?? Number(d.costoSeguridad ?? 0);
            const costoLogistica = l.costoLogistica ?? Number(d.costoLogistica ?? 0);
            const costoUnitario = Number(d.precioCompra ?? 0) + costoEnvio + costoSeguridad + costoLogistica;
            await tx.envioRecepcionItem.create({
              data: {
                recepcionId: recepcion.id,
                envioItemId: item.id,
                cantidad: l.cantidad,
                varianteRecibidaId,
                nota: l.nota?.trim() || undefined,
                costoEnvio,
                costoSeguridad,
                costoLogistica,
              },
            });
            await tx.loteCompra.create({
              data: { varianteId: varianteRecibidaId, almacenId, proformaDetalleId: d.id, costoUnitario, cantidadInicial: l.cantidad, cantidadDisponible: l.cantidad },
            });
            await tx.stock.update({
              where: { varianteId_almacenId: { varianteId: varianteRecibidaId, almacenId } },
              data: { cantidadFisica: { increment: l.cantidad } },
            });
            stockPorPar.get(stockKey(varianteRecibidaId, almacenId))!.cantidadFisica += l.cantidad;
            item.cantidadRecibida += l.cantidad;
            await tx.envioItem.update({ where: { id: item.id }, data: { cantidadRecibida: item.cantidadRecibida } });
            if (varianteRecibidaId === d.varianteId) llegoEsperado.set(d.id, (llegoEsperado.get(d.id) ?? 0) + l.cantidad);
            else diferencias.push(`${d.variante.product.name} x${l.cantidad} → otra variante`);
          }

          const lineasRecibidas = Array.from(new Set(dto.items.map((l) => porId.get(l.envioItemId)!.compraDetalleId)));
          // Solo se cubre lo que está ligado a las compras recibidas, y hasta lo que llegó: el resto del stock
          // libre se reserva a mano (ver ProformaApprovalService.reservarFaltantes).
          const llegoPorVariante = new Map<string, number>();
          for (const [compraDetalleId, llego] of llegoEsperado) {
            const varianteId = envio.items.find((i) => i.compraDetalleId === compraDetalleId)!.compraDetalle.varianteId;
            llegoPorVariante.set(varianteId, (llegoPorVariante.get(varianteId) ?? 0) + llego);
          }
          for (const par of pares) {
            const stock = await tx.stock.findUniqueOrThrow({ where: { varianteId_almacenId: par } });
            await resolverProcuraPendiente(tx, {
              ...par,
              disponible: Math.min(stock.cantidadFisica - stock.cantidadReservada, llegoPorVariante.get(par.varianteId) ?? 0),
              preferirCompraDetalleIds: lineasRecibidas,
              soloPreferidas: true,
            });
          }

          // Lo recibido que no consumieron las ventas ligadas es para las solicitudes de stock de esa línea.
          for (const compraDetalleId of lineasRecibidas) {
            const llego = llegoEsperado.get(compraDetalleId) ?? 0;
            if (llego <= 0) continue;
            const despues = await tx.proformaDetalleAsignacion.aggregate({ where: { compraDetalleId }, _sum: { cantidad: true } });
            const consumido = Math.max(0, (ligadasAntes.get(compraDetalleId) ?? 0) - (despues._sum.cantidad ?? 0));
            let sobrante = Math.max(0, llego - consumido);
            if (sobrante <= 0) continue;
            const solicitudes = await tx.solicitudStockLinea.findMany({ where: { compraDetalleId }, orderBy: { createdAt: "asc" } });
            for (const s of solicitudes) {
              if (sobrante <= 0) break;
              const toca = Math.min(sobrante, s.cantidad - s.cantidadRecibida);
              if (toca <= 0) continue;
              await tx.solicitudStockLinea.update({ where: { id: s.id }, data: { cantidadRecibida: { increment: toca } } });
              sobrante -= toca;
            }
          }

          // Lo recibido deja de estar en tránsito: las ventas que lo tenían reservado en tránsito pasan a reservar
          // el stock físico que acaba de llegar (el resto vuelve a Procura).
          for (const compraDetalleId of lineasRecibidas) await recalcularTransitoLinea(tx, compraDetalleId, { convertirAFisico: true });

          // Una compra se completa cuando todas sus líneas llegaron por completo.
          const compraIds = Array.from(new Set(envio.items.filter((i) => lineasRecibidas.includes(i.compraDetalleId)).map((i) => i.compraDetalle.proformaId)));
          for (const compraId of compraIds) {
            const detalles = await tx.proformaDetalle.findMany({
              where: { proformaId: compraId },
              select: { cantidad: true, envioItems: { where: { envio: { estado: { not: EstadoEnvio.ANULADO } } }, select: { cantidadRecibida: true } } },
            });
            const completa = detalles.every((d) => d.envioItems.reduce((n, i) => n + i.cantidadRecibida, 0) >= d.cantidad);
            if (!completa) continue;
            await tx.proforma.update({ where: { id: compraId }, data: { estado: EstadoProforma.COMPLETADA, almacenId } });
            const nota = `Recibida en el envío ${envio.codigo}.${diferencias.length ? ` Diferencias: ${diferencias.join("; ")}.` : ""}`;
            await this.historial.registrar(tx, compraId, EstadoProforma.COMPLETADA, usuarioId, nota);
          }

          if (envio.items.every((i) => i.cantidadRecibida >= i.cantidad)) {
            await tx.envio.update({ where: { id }, data: { estado: EstadoEnvio.RECIBIDO, fechaRecepcion: new Date() } });
          }
        },
        { timeout: 30000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Envío");
    }
    return this.findOne(id);
  }

  /** Cierra un envío en camino dando por no llegado lo que falta: esas unidades vuelven a estar por enviar. */
  async cerrar(id: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const lock = await this.lockEnvio(tx, id);
          this.assertEstado(lock, [EstadoEnvio.EN_TRANSITO], "cerrar");
          if ((await tx.envioRecepcion.count({ where: { envioId: id } })) === 0) {
            throw new ConflictException("El envío no recibió nada todavía: anulalo si no va a llegar.");
          }
          const items = await tx.envioItem.findMany({
            where: { envioId: id },
            select: { id: true, cantidad: true, cantidadRecibida: true },
          });
          for (const item of items) {
            if (item.cantidadRecibida === 0) await tx.envioItem.delete({ where: { id: item.id } });
            else await tx.envioItem.update({ where: { id: item.id }, data: { cantidad: item.cantidadRecibida } });
          }
          await tx.envio.update({ where: { id }, data: { estado: EstadoEnvio.RECIBIDO, fechaRecepcion: new Date() } });
        },
        { timeout: 20000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Envío");
    }
    return this.findOne(id);
  }
}
