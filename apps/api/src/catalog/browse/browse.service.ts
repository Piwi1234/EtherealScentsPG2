import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AttributeType, AttributeVariantMode, Prisma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { CategoryService } from "../category/category.service";
import { AttributeService } from "../attribute/attribute.service";
import { SettingsService } from "../../settings/settings.service";
import { withPrice } from "../product-price";

const includeDetails = {
  brand: true,
  category: true,
  attributeValues: { include: { attribute: true, option: true } },
  variantOptionValues: { include: { attribute: true } },
  variants: { include: { options: { include: { optionValue: { include: { attribute: true } } } } } },
} as const;

export interface FindCatalogProductsQuery {
  categoryId?: string;
  brandId?: string;
  page?: string;
  pageSize?: string;
  /** Busca por nombre de producto o de marca (contiene, sin distinguir mayúsculas). */
  search?: string;
  /** Filtros dinámicos por atributo filtrable: { [attributeId]: "valor1,valor2" }. */
  attr?: Record<string, string>;
  /** "true": solo productos con descuento (descuento propio, o el de alguna de sus variantes con
   * precio propio — no se mira la variante "default" auto-provista, su descuento queda congelado al
   * crearse y el producto sigue siendo la fuente de verdad para catálogo simple). */
  onlyDiscounted?: string;
  /** "true": solo productos con un temporizador de "Ofertas Flash" todavía vigente
   * (ofertaFlashHasta en el futuro). */
  onlyFlash?: string;
  /** "actualizados": orden por última modificación (usado por el carrusel de ofertas del home).
   * Cualquier otro valor (u omitido) mantiene el orden por defecto, más reciente creado primero. */
  sortBy?: string;
}

@Injectable()
export class CatalogBrowseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoryService,
    private readonly attributes: AttributeService,
    private readonly settings: SettingsService,
  ) {}

  async findProducts(query: FindCatalogProductsQuery) {
    const { page, pageSize, skip, take } = getPagination({
      page: query.page ?? "1",
      pageSize: query.pageSize ?? "20",
    });

    const andConditions: Prisma.ProductWhereInput[] = [];

    if (query.categoryId) {
      // Filtrar por una categoría incluye sus subcategorías (ej: "Electrónica" trae Celulares y Laptops).
      const categoryIds = await this.categories.getDescendantIds(query.categoryId);
      andConditions.push({ categoryId: { in: categoryIds } });
    }

    if (query.brandId) {
      andConditions.push({ brandId: query.brandId });
    }

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      andConditions.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { brand: { name: { contains: search, mode: "insensitive" } } },
        ],
      });
    }

    if (query.attr && Object.keys(query.attr).length > 0) {
      andConditions.push(...(await this.buildAttributeFilters(query.attr)));
    }

    if (query.onlyDiscounted === "true") {
      andConditions.push({
        OR: [{ discountBs: { gt: 0 } }, { variants: { some: { isDefault: false, discountBs: { gt: 0 } } } }],
      });
    }

    if (query.onlyFlash === "true") {
      andConditions.push({ ofertaFlashHasta: { gt: new Date() } });
    }

    const where: Prisma.ProductWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};
    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sortBy === "actualizados" ? { updatedAt: "desc" } : { createdAt: "desc" };

    const [items, total, exchangeRate] = await Promise.all([
      this.prisma.product.findMany({ where, skip, take, orderBy, include: includeDetails }),
      this.prisma.product.count({ where }),
      this.settings.getExchangeRate(),
    ]);

    return { items: items.map((item) => withPrice(item, exchangeRate)), total, page, pageSize };
  }

  /** Detalle público de un producto (página de producto del catálogo). */
  async getProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: includeDetails });
    if (!product) {
      throw new NotFoundException("Producto no encontrado.");
    }
    const exchangeRate = await this.settings.getExchangeRate();
    return withPrice(product, exchangeRate);
  }

  /** Para la página pública /producto/[slug] — URL corta y legible en vez del uuid. */
  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({ where: { slug }, include: includeDetails });
    if (!product) {
      throw new NotFoundException("Producto no encontrado.");
    }
    const exchangeRate = await this.settings.getExchangeRate();
    return withPrice(product, exchangeRate);
  }

  /**
   * Atributos filtrables disponibles para una categoría (propios + heredados), con sus opciones.
   * Los atributos con precio propio (variantMode PRICED_VARIANT) nunca se ofrecen como filtro acá,
   * aunque estén marcados isFilterable: ya tienen su propio mecanismo de selección de variante.
   */
  async getFiltersForCategory(categoryId: string) {
    const attributes = await this.attributes.listForCategory(categoryId, true);
    return attributes.filter(
      (attribute) => attribute.isFilterable && attribute.variantMode !== AttributeVariantMode.PRICED_VARIANT,
    );
  }

  private async buildAttributeFilters(attrQuery: Record<string, string>): Promise<Prisma.ProductWhereInput[]> {
    const attributeIds = Object.keys(attrQuery);
    const definitions = await this.prisma.attribute.findMany({
      where: { id: { in: attributeIds } },
      include: { options: true },
    });
    const byId = new Map(definitions.map((definition) => [definition.id, definition]));

    return attributeIds.map((attributeId) => {
      const definition = byId.get(attributeId);
      if (!definition) {
        throw new BadRequestException(`Atributo inexistente: ${attributeId}`);
      }
      if (!definition.isFilterable) {
        throw new BadRequestException(`El atributo '${definition.name}' no es filtrable.`);
      }

      const rawValues = attrQuery[attributeId]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      if (rawValues.length === 0) {
        throw new BadRequestException(`Valor vacío para el filtro de atributo '${definition.name}'.`);
      }

      if (definition.variantMode !== AttributeVariantMode.NONE) {
        // MULTI_VALUE / PRICED_VARIANT: los valores son propios de cada producto (no hay
        // AttributeOption compartida), así que se filtra por el texto del valor.
        return { variantOptionValues: { some: { attributeId, value: { in: rawValues } } } };
      }

      if (definition.type === AttributeType.SELECT) {
        const validOptionIds = new Set(definition.options.map((option) => option.id));
        const invalid = rawValues.filter((value) => !validOptionIds.has(value));
        if (invalid.length > 0) {
          throw new BadRequestException(`optionId inválido para '${definition.name}': ${invalid.join(", ")}`);
        }
        return { attributeValues: { some: { attributeId, optionId: { in: rawValues } } } };
      }

      if (definition.type === AttributeType.TEXT) {
        return { attributeValues: { some: { attributeId, valueText: { in: rawValues } } } };
      }

      if (definition.type === AttributeType.BOOLEAN) {
        return { attributeValues: { some: { attributeId, valueBoolean: rawValues[0] === "true" } } };
      }

      // AttributeType.NUMBER
      const numbers = rawValues.map(Number);
      if (numbers.some((value) => Number.isNaN(value))) {
        throw new BadRequestException(`Valor numérico inválido para '${definition.name}'.`);
      }
      return { attributeValues: { some: { attributeId, valueNumber: { in: numbers } } } };
    });
  }
}
