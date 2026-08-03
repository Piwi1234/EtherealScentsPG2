import { BadRequestException, Injectable } from "@nestjs/common";
import { AttributeType, Prisma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { CategoryService } from "../category/category.service";
import { AttributeService } from "../attribute/attribute.service";
import { withTotalCost } from "../product-cost";

const includeDetails = {
  brand: true,
  category: true,
  attributeValues: { include: { attribute: true, option: true } },
} as const;

export interface FindCatalogProductsQuery {
  categoryId?: string;
  brandId?: string;
  page?: string;
  pageSize?: string;
  /** Filtros dinámicos por atributo filtrable: { [attributeId]: "valor1,valor2" }. */
  attr?: Record<string, string>;
}

@Injectable()
export class CatalogBrowseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoryService,
    private readonly attributes: AttributeService,
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

    if (query.attr && Object.keys(query.attr).length > 0) {
      andConditions.push(...(await this.buildAttributeFilters(query.attr)));
    }

    const where: Prisma.ProductWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: includeDetails }),
      this.prisma.product.count({ where }),
    ]);

    return { items: items.map(withTotalCost), total, page, pageSize };
  }

  /** Atributos filtrables disponibles para una categoría (propios + heredados), con sus opciones. */
  async getFiltersForCategory(categoryId: string) {
    const attributes = await this.attributes.listForCategory(categoryId, true);
    return attributes.filter((attribute) => attribute.isFilterable);
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
