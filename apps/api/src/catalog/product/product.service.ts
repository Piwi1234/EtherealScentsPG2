import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AttributeType, Prisma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CategoryService } from "../category/category.service";
import { AttributeService } from "../attribute/attribute.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductAttributeValueInputDto } from "./dto/product-attribute-value.dto";

const includeDetails = {
  brand: true,
  category: true,
  attributeValues: { include: { attribute: true, option: true } },
} as const;

type AttributeValueWrite = {
  attributeId: string;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  optionId?: string;
};

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoryService,
    private readonly attributes: AttributeService,
  ) {}

  /**
   * Valida que los atributos enviados pertenezcan a la categoría del producto
   * (propios o heredados de un ancestro), que estén los requeridos, y que el
   * campo de valor usado coincida con el `type` del atributo.
   */
  private async buildAttributeValuesData(
    categoryId: string,
    inputs: ProductAttributeValueInputDto[] = [],
  ): Promise<AttributeValueWrite[]> {
    const definitions = await this.attributes.listForCategory(categoryId, true);
    const byId = new Map(definitions.map((attr) => [attr.id, attr]));

    const providedIds = new Set(inputs.map((input) => input.attributeId));
    for (const definition of definitions) {
      if (definition.isRequired && !providedIds.has(definition.id)) {
        throw new BadRequestException(`Falta el atributo requerido '${definition.name}'.`);
      }
    }

    return inputs.map((input): AttributeValueWrite => {
      const definition = byId.get(input.attributeId);
      if (!definition) {
        throw new BadRequestException(
          `El atributo ${input.attributeId} no está definido para esta categoría ni sus categorías padre.`,
        );
      }

      switch (definition.type) {
        case AttributeType.TEXT:
          if (!input.valueText) {
            throw new BadRequestException(`El atributo '${definition.name}' requiere 'valueText'.`);
          }
          return { attributeId: definition.id, valueText: input.valueText };
        case AttributeType.NUMBER:
          if (input.valueNumber === undefined) {
            throw new BadRequestException(`El atributo '${definition.name}' requiere 'valueNumber'.`);
          }
          return { attributeId: definition.id, valueNumber: input.valueNumber };
        case AttributeType.BOOLEAN:
          if (input.valueBoolean === undefined) {
            throw new BadRequestException(`El atributo '${definition.name}' requiere 'valueBoolean'.`);
          }
          return { attributeId: definition.id, valueBoolean: input.valueBoolean };
        case AttributeType.SELECT: {
          if (!input.optionId) {
            throw new BadRequestException(`El atributo '${definition.name}' requiere 'optionId'.`);
          }
          const validOption = definition.options.some((option) => option.id === input.optionId);
          if (!validOption) {
            throw new BadRequestException(`'optionId' inválido para el atributo '${definition.name}'.`);
          }
          return { attributeId: definition.id, optionId: input.optionId };
        }
      }
    });
  }

  private async assertBrandExists(brandId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new BadRequestException(`brandId inválido: ${brandId}`);
    }
  }

  async create(dto: CreateProductDto) {
    await this.categories.findOne(dto.categoryId);
    if (dto.brandId) {
      await this.assertBrandExists(dto.brandId);
    }

    const attributeValuesData = await this.buildAttributeValuesData(dto.categoryId, dto.attributeValues);

    try {
      return await this.prisma.product.create({
        data: {
          name: dto.name,
          sku: dto.sku,
          price: dto.price,
          stock: dto.stock ?? 0,
          brandId: dto.brandId,
          categoryId: dto.categoryId,
          attributeValues: { create: attributeValuesData },
        },
        include: includeDetails,
      });
    } catch (error) {
      rethrowPrismaError(error, "Producto");
    }
  }

  async findAll(query: { page?: string; pageSize?: string; categoryId?: string; brandId?: string }) {
    const { page, pageSize, skip, take } = getPagination({
      page: query.page ?? "1",
      pageSize: query.pageSize ?? "20",
    });
    const where: Prisma.ProductWhereInput = {
      categoryId: query.categoryId,
      brandId: query.brandId,
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: includeDetails }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: includeDetails });
    if (!product) {
      throw new NotFoundException("Producto no encontrado.");
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.findOne(id);

    if (dto.brandId) {
      await this.assertBrandExists(dto.brandId);
    }
    if (dto.categoryId) {
      await this.categories.findOne(dto.categoryId);
    }

    const categoryId = dto.categoryId ?? existing.categoryId;
    const categoryChanged = dto.categoryId !== undefined && dto.categoryId !== existing.categoryId;

    let attributeValuesData: AttributeValueWrite[] | undefined;
    if (dto.attributeValues !== undefined) {
      attributeValuesData = await this.buildAttributeValuesData(categoryId, dto.attributeValues);
    } else if (categoryChanged) {
      // Los valores existentes están atados a los atributos de la categoría anterior: ya no aplican.
      attributeValuesData = [];
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (attributeValuesData) {
          await tx.productAttributeValue.deleteMany({ where: { productId: id } });
          if (attributeValuesData.length > 0) {
            await tx.productAttributeValue.createMany({
              data: attributeValuesData.map((value) => ({ ...value, productId: id })),
            });
          }
        }

        return tx.product.update({
          where: { id },
          data: {
            name: dto.name,
            sku: dto.sku,
            price: dto.price,
            stock: dto.stock,
            brandId: dto.brandId,
            categoryId: dto.categoryId,
          },
          include: includeDetails,
        });
      });
    } catch (error) {
      rethrowPrismaError(error, "Producto");
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.product.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, "Producto");
    }
  }
}
