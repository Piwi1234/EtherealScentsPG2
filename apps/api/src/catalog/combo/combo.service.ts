import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoVariante, Prisma, UnidadVariante } from "@app/database";
import { slugify } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { deleteFromR2 } from "../../common/r2-storage";
import { SettingsService } from "../../settings/settings.service";
import { CategoryService } from "../category/category.service";
import { computeBsPrices, computeCatalogPrice } from "../product-price";
import { generateUniqueEntityCode } from "../entity-code";
import { ComboItemDto, CreateComboDto, UpdateComboDto } from "./dto/combo.dto";

const comboInclude = {
  category: { select: { id: true, name: true, slug: true } },
  items: {
    include: {
      variante: {
        include: {
          options: { include: { optionValue: true } },
          stock: { select: { cantidadFisica: true, cantidadReservada: true } },
          product: { include: { brand: { select: { id: true, name: true } }, category: true } },
        },
      },
    },
  },
} satisfies Prisma.ComboInclude;

type ComboRaw = Prisma.ComboGetPayload<{ include: typeof comboInclude }>;

const redondear2 = (n: number) => Math.round(n * 100) / 100;

/** Precio final Bs de una variante, igual que en el catálogo: la auto-provista (isDefault) toma los precios del producto. */
function precioFinalBs(v: ComboRaw["items"][number]["variante"], exchangeRate: number): { finalBs: number; conDescuento: boolean } {
  const fuente = v.isDefault ? v.product : v;
  const priceUsd = computeCatalogPrice(fuente.purchasePrice, fuente.utility, v.product.category);
  const { finalPriceBs } = computeBsPrices(priceUsd, fuente, exchangeRate);
  return { finalBs: finalPriceBs, conDescuento: Number(fuente.discountBs) > 0 };
}

/**
 * Combos: 2 a 4 productos de una misma categoría que se venden juntos con un descuento fijo en Bs. El precio no se guarda: se
 * calcula siempre en vivo con el precio final actual de cada componente (suma − descuento), así nunca queda desactualizado si
 * cambia el precio de un producto o el tipo de cambio. Ver Combo en schema.prisma.
 */
@Injectable()
export class ComboService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoryService,
    private readonly settings: SettingsService,
  ) {}

  /** Arma la respuesta de un combo con sus precios y disponibilidad. `admin` suma el stock exacto por componente (la web pública nunca lo ve). */
  private presentar(combo: ComboRaw, exchangeRate: number, admin: boolean) {
    const items = combo.items
      .map((it) => {
        const v = it.variante;
        const { finalBs, conDescuento } = precioFinalBs(v, exchangeRate);
        const disponible = v.stock.reduce((n, s) => n + s.cantidadFisica - s.cantidadReservada, 0);
        const etiqueta = v.options.map((o) => o.optionValue.value).join(" · ");
        return {
          id: it.id,
          varianteId: v.id,
          cantidad: it.cantidad,
          producto: { id: v.product.id, name: v.product.name, slug: v.product.slug, productCode: v.product.productCode, brand: v.product.brand },
          variante: { id: v.id, etiqueta: etiqueta || null, estado: v.estado, isDefault: v.isDefault },
          imageUrl: v.imageUrl ?? v.product.imageUrl,
          precioUnitarioBs: finalBs,
          subtotalBs: finalBs * it.cantidad,
          conDescuento,
          // Alcanza el stock para las unidades que lleva el combo (una variante en Preventa se vende sin stock).
          hayStock: v.estado === EstadoVariante.PREVENTA || disponible >= it.cantidad,
          ...(admin ? { stockDisponible: disponible } : {}),
        };
      })
      .sort((a, b) => a.producto.name.localeCompare(b.producto.name));

    const sumaBs = items.reduce((n, i) => n + i.subtotalBs, 0);
    const descuentoBs = Number(combo.descuentoBs);
    const totalBs = Math.max(0, redondear2(sumaBs - descuentoBs));
    const noDisponible = combo.items.some((it) => it.variante.estado === EstadoVariante.NO_DISPONIBLE);
    const agotado = noDisponible || items.some((i) => !i.hayStock);
    const preventa = !agotado && combo.items.some((it) => it.variante.estado === EstadoVariante.PREVENTA);

    return {
      id: combo.id,
      nombre: combo.nombre,
      slug: combo.slug,
      comboCode: combo.comboCode,
      descripcion: combo.descripcion,
      imageUrl: combo.imageUrl,
      publicado: combo.publicado,
      orden: combo.orden,
      categoryId: combo.categoryId,
      category: combo.category,
      items,
      sumaBs,
      descuentoBs,
      totalBs,
      ahorroBs: redondear2(sumaBs - totalBs),
      agotado,
      preventa,
      createdAt: combo.createdAt,
      updatedAt: combo.updatedAt,
    };
  }

  // ---- gestión ----

  async findAll(query: { categoryId?: string; search?: string }) {
    const categoryIds = query.categoryId ? await this.categories.getDescendantIds(query.categoryId) : undefined;
    const search = query.search?.trim();
    const [combos, rate] = await Promise.all([
      this.prisma.combo.findMany({
        where: {
          categoryId: categoryIds ? { in: categoryIds } : undefined,
          ...(search ? { OR: [{ nombre: { contains: search, mode: "insensitive" } }, { comboCode: { contains: search.toUpperCase() } }] } : {}),
        },
        include: comboInclude,
        orderBy: [{ orden: "asc" }, { createdAt: "desc" }],
      }),
      this.settings.getExchangeRate(),
    ]);
    return combos.map((c) => this.presentar(c, rate, true));
  }

  async findOne(id: string) {
    const [combo, rate] = await Promise.all([this.prisma.combo.findUnique({ where: { id }, include: comboInclude }), this.settings.getExchangeRate()]);
    if (!combo) throw new NotFoundException("Combo no encontrado.");
    return this.presentar(combo, rate, true);
  }

  /** 2 a 4 variantes distintas, en piezas, de la categoría del combo (o sus subcategorías), y descuento menor que la suma. */
  private async validar(categoryId: string, items: ComboItemDto[], descuentoBs: number) {
    if (items.length < 2 || items.length > 4) throw new BadRequestException("Un combo lleva entre 2 y 4 productos.");
    if (new Set(items.map((i) => i.varianteId)).size !== items.length) {
      throw new BadRequestException("No repitas el mismo producto: para llevar más de una unidad sube su cantidad.");
    }
    const categoriaIds = await this.categories.getDescendantIds(categoryId);

    const variantes = await this.prisma.productVariant.findMany({
      where: { id: { in: items.map((i) => i.varianteId) } },
      include: {
        options: { include: { optionValue: true } },
        stock: { select: { cantidadFisica: true, cantidadReservada: true } },
        product: { include: { brand: { select: { id: true, name: true } }, category: true } },
      },
    });
    if (variantes.length !== items.length) throw new BadRequestException("Alguno de los productos elegidos no existe.");
    for (const v of variantes) {
      if (v.unidad !== UnidadVariante.PZA) throw new BadRequestException(`"${v.product.name}" se vende en ml (decants) y no puede ir en un combo.`);
      if (!categoriaIds.includes(v.product.categoryId)) {
        throw new BadRequestException(`"${v.product.name}" no es de la categoría del combo: todos los productos tienen que ser de la misma categoría.`);
      }
    }
    const rate = await this.settings.getExchangeRate();
    const suma = items.reduce((n, it) => {
      const v = variantes.find((x) => x.id === it.varianteId)!;
      return n + precioFinalBs(v as unknown as ComboRaw["items"][number]["variante"], rate).finalBs * it.cantidad;
    }, 0);
    if (descuentoBs >= suma) throw new BadRequestException(`El descuento (Bs ${descuentoBs}) tiene que ser menor que la suma de los productos (Bs ${suma}).`);
  }

  async create(dto: CreateComboDto) {
    const descuentoBs = dto.descuentoBs ?? 0;
    await this.validar(dto.categoryId, dto.items, descuentoBs);
    const comboCode = await generateUniqueEntityCode(async (code) => Boolean(await this.prisma.combo.findUnique({ where: { comboCode: code }, select: { id: true } })));
    try {
      const creado = await this.prisma.combo.create({
        data: {
          nombre: dto.nombre.trim(),
          slug: `${slugify(dto.nombre)}-${comboCode.toLowerCase()}`,
          comboCode,
          categoryId: dto.categoryId,
          descripcion: dto.descripcion?.trim() || null,
          descuentoBs,
          publicado: dto.publicado ?? false,
          items: { create: dto.items.map((i) => ({ varianteId: i.varianteId, cantidad: i.cantidad })) },
        },
        select: { id: true },
      });
      return this.findOne(creado.id);
    } catch (error) {
      rethrowPrismaError(error, "Combo");
    }
  }

  async update(id: string, dto: UpdateComboDto) {
    const actual = await this.prisma.combo.findUnique({ where: { id }, include: { items: true } });
    if (!actual) throw new NotFoundException("Combo no encontrado.");
    const categoryId = dto.categoryId ?? actual.categoryId;
    const items = dto.items ?? actual.items.map((i) => ({ varianteId: i.varianteId, cantidad: i.cantidad }));
    const descuentoBs = dto.descuentoBs ?? Number(actual.descuentoBs);
    await this.validar(categoryId, items, descuentoBs);
    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.items) await tx.comboItem.deleteMany({ where: { comboId: id } });
        await tx.combo.update({
          where: { id },
          data: {
            nombre: dto.nombre?.trim(),
            categoryId: dto.categoryId,
            descripcion: dto.descripcion === undefined ? undefined : dto.descripcion?.trim() || null,
            descuentoBs: dto.descuentoBs,
            publicado: dto.publicado,
            items: dto.items ? { create: dto.items.map((i) => ({ varianteId: i.varianteId, cantidad: i.cantidad })) } : undefined,
          },
        });
      });
      return this.findOne(id);
    } catch (error) {
      rethrowPrismaError(error, "Combo");
    }
  }

  async remove(id: string) {
    const combo = await this.prisma.combo.findUnique({ where: { id }, select: { imageUrl: true } });
    if (!combo) throw new NotFoundException("Combo no encontrado.");
    await this.prisma.combo.delete({ where: { id } });
    if (combo.imageUrl) await deleteFromR2(combo.imageUrl).catch(() => {});
    return { ok: true };
  }

  async setImage(id: string, file: Express.Multer.File) {
    const existente = await this.prisma.combo.findUnique({ where: { id }, select: { imageUrl: true } });
    if (!existente) throw new NotFoundException("Combo no encontrado.");
    // file.filename ya es la URL pública completa (ver WebpUploadInterceptor).
    await this.prisma.combo.update({ where: { id }, data: { imageUrl: file.filename } });
    if (existente.imageUrl) await deleteFromR2(existente.imageUrl).catch(() => {});
    return this.findOne(id);
  }

  // ---- web pública ----

  async findPublic(query: { categoryId?: string }) {
    const categoryIds = query.categoryId ? await this.categories.getDescendantIds(query.categoryId) : undefined;
    const [combos, rate] = await Promise.all([
      this.prisma.combo.findMany({
        where: { publicado: true, categoryId: categoryIds ? { in: categoryIds } : undefined },
        include: comboInclude,
        orderBy: [{ orden: "asc" }, { createdAt: "desc" }],
      }),
      this.settings.getExchangeRate(),
    ]);
    return combos.map((c) => this.presentar(c, rate, false));
  }

  async findPublicBySlug(slug: string) {
    const [combo, rate] = await Promise.all([
      this.prisma.combo.findFirst({ where: { slug, publicado: true }, include: comboInclude }),
      this.settings.getExchangeRate(),
    ]);
    if (!combo) throw new NotFoundException("Combo no encontrado.");
    return this.presentar(combo, rate, false);
  }
}
