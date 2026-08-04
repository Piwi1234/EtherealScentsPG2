import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AttributeType, AttributeVariantMode, Prisma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CategoryService } from "../category/category.service";
import { AttributeService } from "../attribute/attribute.service";
import { SettingsService } from "../../settings/settings.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductAttributeValueInputDto } from "./dto/product-attribute-value.dto";
import { CreateProductVariantDto, UpdateProductVariantDto } from "./dto/product-variant.dto";
import { generateUniqueEntityCode } from "../entity-code";
import { withPrice } from "../product-price";
import { PRODUCT_IMAGES_DIR } from "./product-image.multer";

const includeDetails = {
  brand: true,
  category: true,
  attributeValues: { include: { attribute: true, option: true } },
  variants: { include: { options: { include: { attribute: true, option: true } } } },
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
    private readonly settings: SettingsService,
  ) {}

  /**
   * Valida que los atributos enviados pertenezcan a la categoría del producto (propios o
   * heredados de un ancestro), que estén los requeridos, que el campo de valor usado coincida
   * con el `type` del atributo, y que los MULTI_VALUE puedan traer más de un valor mientras que
   * el resto solo admite uno. Los PRICED_VARIANT no se manejan acá: van por /products/:id/variants.
   */
  private async buildAttributeValuesData(
    categoryId: string,
    inputs: ProductAttributeValueInputDto[] = [],
  ): Promise<AttributeValueWrite[]> {
    const definitions = await this.attributes.listForCategory(categoryId, true);
    const byId = new Map(definitions.map((attr) => [attr.id, attr]));

    const inputsByAttribute = new Map<string, ProductAttributeValueInputDto[]>();
    for (const input of inputs) {
      const list = inputsByAttribute.get(input.attributeId) ?? [];
      list.push(input);
      inputsByAttribute.set(input.attributeId, list);
    }

    for (const definition of definitions) {
      if (definition.variantMode === AttributeVariantMode.PRICED_VARIANT) continue;
      const provided = inputsByAttribute.get(definition.id) ?? [];
      if (definition.isRequired && provided.length === 0) {
        throw new BadRequestException(`Falta el atributo requerido '${definition.name}'.`);
      }
      if (definition.variantMode !== AttributeVariantMode.MULTI_VALUE && provided.length > 1) {
        throw new BadRequestException(`El atributo '${definition.name}' no admite más de un valor.`);
      }
    }

    const result: AttributeValueWrite[] = [];
    const seenOptionsByAttribute = new Map<string, Set<string>>();

    for (const input of inputs) {
      const definition = byId.get(input.attributeId);
      if (!definition) {
        throw new BadRequestException(
          `El atributo ${input.attributeId} no está definido para esta categoría ni sus categorías padre.`,
        );
      }
      if (definition.variantMode === AttributeVariantMode.PRICED_VARIANT) {
        throw new BadRequestException(
          `El atributo '${definition.name}' tiene precio propio por valor: se administra desde las variantes del producto.`,
        );
      }

      switch (definition.type) {
        case AttributeType.TEXT:
          if (!input.valueText) {
            throw new BadRequestException(`El atributo '${definition.name}' requiere 'valueText'.`);
          }
          result.push({ attributeId: definition.id, valueText: input.valueText });
          break;
        case AttributeType.NUMBER:
          if (input.valueNumber === undefined) {
            throw new BadRequestException(`El atributo '${definition.name}' requiere 'valueNumber'.`);
          }
          result.push({ attributeId: definition.id, valueNumber: input.valueNumber });
          break;
        case AttributeType.BOOLEAN:
          if (input.valueBoolean === undefined) {
            throw new BadRequestException(`El atributo '${definition.name}' requiere 'valueBoolean'.`);
          }
          result.push({ attributeId: definition.id, valueBoolean: input.valueBoolean });
          break;
        case AttributeType.SELECT: {
          if (!input.optionId) {
            throw new BadRequestException(`El atributo '${definition.name}' requiere 'optionId'.`);
          }
          const validOption = definition.options.some((option) => option.id === input.optionId);
          if (!validOption) {
            throw new BadRequestException(`'optionId' inválido para el atributo '${definition.name}'.`);
          }
          const seen = seenOptionsByAttribute.get(definition.id) ?? new Set<string>();
          if (seen.has(input.optionId)) {
            throw new BadRequestException(`Valor repetido para el atributo '${definition.name}'.`);
          }
          seen.add(input.optionId);
          seenOptionsByAttribute.set(definition.id, seen);
          result.push({ attributeId: definition.id, optionId: input.optionId });
          break;
        }
      }
    }

    return result;
  }

  private async assertBrandExists(brandId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      throw new BadRequestException(`brandId inválido: ${brandId}`);
    }
  }

  private generateProductCode() {
    return generateUniqueEntityCode(async (code) => {
      const existing = await this.prisma.product.findUnique({ where: { productCode: code }, select: { id: true } });
      return Boolean(existing);
    });
  }

  private generateVariantCode() {
    return generateUniqueEntityCode(async (code) => {
      const existing = await this.prisma.productVariant.findUnique({ where: { variantCode: code }, select: { id: true } });
      return Boolean(existing);
    });
  }

  /** Si la categoría (propia o heredada) tiene algún atributo con precio propio, el precio se carga por variante. */
  private async categoryHasPricedVariants(categoryId: string): Promise<boolean> {
    const definitions = await this.attributes.listForCategory(categoryId, true);
    return definitions.some((attr) => attr.variantMode === AttributeVariantMode.PRICED_VARIANT);
  }

  async create(dto: CreateProductDto) {
    await this.categories.findOne(dto.categoryId);
    if (dto.brandId) {
      await this.assertBrandExists(dto.brandId);
    }

    const hasPricedVariants = await this.categoryHasPricedVariants(dto.categoryId);
    if (!hasPricedVariants && dto.purchasePrice === undefined) {
      throw new BadRequestException(
        "El precio de compra es obligatorio (esta categoría no tiene atributos con precio propio).",
      );
    }

    const attributeValuesData = await this.buildAttributeValuesData(dto.categoryId, dto.attributeValues);
    const productCode = await this.generateProductCode();

    try {
      const product = await this.prisma.product.create({
        data: {
          name: dto.name,
          productCode,
          purchasePrice: dto.purchasePrice ?? 0,
          utility: dto.utility ?? 0,
          minPriceBs: dto.minPriceBs,
          discountBs: dto.discountBs ?? 0,
          brandId: dto.brandId,
          categoryId: dto.categoryId,
          attributeValues: { create: attributeValuesData },
        },
        include: includeDetails,
      });
      return withPrice(product, await this.settings.getExchangeRate());
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

    const [items, total, exchangeRate] = await Promise.all([
      this.prisma.product.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: includeDetails }),
      this.prisma.product.count({ where }),
      this.settings.getExchangeRate(),
    ]);

    return { items: items.map((item) => withPrice(item, exchangeRate)), total, page, pageSize };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: includeDetails });
    if (!product) {
      throw new NotFoundException("Producto no encontrado.");
    }
    return withPrice(product, await this.settings.getExchangeRate());
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

    const hasPricedVariants = await this.categoryHasPricedVariants(categoryId);
    const resultingPurchasePrice = dto.purchasePrice ?? Number(existing.purchasePrice);
    if (!hasPricedVariants && !resultingPurchasePrice) {
      throw new BadRequestException(
        "El precio de compra es obligatorio (esta categoría no tiene atributos con precio propio).",
      );
    }

    let attributeValuesData: AttributeValueWrite[] | undefined;
    if (dto.attributeValues !== undefined) {
      attributeValuesData = await this.buildAttributeValuesData(categoryId, dto.attributeValues);
    } else if (categoryChanged) {
      // Los valores existentes están atados a los atributos de la categoría anterior: ya no aplican.
      attributeValuesData = [];
    }

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        if (attributeValuesData) {
          await tx.productAttributeValue.deleteMany({ where: { productId: id } });
          if (attributeValuesData.length > 0) {
            await tx.productAttributeValue.createMany({
              data: attributeValuesData.map((value) => ({ ...value, productId: id })),
            });
          }
        }
        // Si cambia de categoría, las variantes con precio quedan atadas a atributos que ya no aplican.
        if (categoryChanged) {
          await tx.productVariant.deleteMany({ where: { productId: id } });
        }

        return tx.product.update({
          where: { id },
          data: {
            name: dto.name,
            purchasePrice: dto.purchasePrice,
            utility: dto.utility,
            minPriceBs: dto.minPriceBs,
            discountBs: dto.discountBs,
            brandId: dto.brandId,
            categoryId: dto.categoryId,
          },
          include: includeDetails,
        });
      });
      return withPrice(product, await this.settings.getExchangeRate());
    } catch (error) {
      rethrowPrismaError(error, "Producto");
    }
  }

  async setImage(id: string, file: Express.Multer.File) {
    const existing = await this.findOne(id);

    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data: { imageUrl: `/uploads/products/${file.filename}` },
        include: includeDetails,
      });

      // Best-effort: borra el archivo anterior para no acumular huérfanos en disco.
      if (existing.imageUrl) {
        const previousFilename = existing.imageUrl.split("/").pop();
        if (previousFilename) {
          await unlink(join(PRODUCT_IMAGES_DIR, previousFilename)).catch(() => {});
        }
      }

      return withPrice(updated, await this.settings.getExchangeRate());
    } catch (error) {
      rethrowPrismaError(error, "Producto");
    }
  }

  /**
   * Valida y arma las opciones (attributeId+optionId) de una variante con precio propio:
   * cada atributo debe ser PRICED_VARIANT de la categoría del producto (propio o heredado),
   * la opción debe pertenecerle, y no puede repetirse el atributo dentro de la misma variante.
   */
  private async buildVariantOptions(categoryId: string, options: { attributeId: string; optionId: string }[]) {
    if (options.length === 0) {
      throw new BadRequestException("Una variante necesita al menos un valor de atributo con precio propio.");
    }

    const definitions = await this.attributes.listForCategory(categoryId, true);
    const byId = new Map(definitions.map((attr) => [attr.id, attr]));

    const seenAttributes = new Set<string>();
    for (const { attributeId, optionId } of options) {
      const definition = byId.get(attributeId);
      if (!definition || definition.variantMode !== AttributeVariantMode.PRICED_VARIANT) {
        throw new BadRequestException(`El atributo ${attributeId} no es un atributo con precio propio de esta categoría.`);
      }
      if (seenAttributes.has(attributeId)) {
        throw new BadRequestException(`Valor repetido para el atributo '${definition.name}' en la variante.`);
      }
      seenAttributes.add(attributeId);
      if (!definition.options.some((option) => option.id === optionId)) {
        throw new BadRequestException(`'optionId' inválido para el atributo '${definition.name}'.`);
      }
    }

    return options;
  }

  /** Ninguna otra variante del producto puede tener exactamente la misma combinación de valores. */
  private async assertVariantCombinationIsUnique(
    productId: string,
    options: { attributeId: string; optionId: string }[],
    excludeVariantId?: string,
  ) {
    const existingVariants = await this.prisma.productVariant.findMany({
      where: { productId, id: excludeVariantId ? { not: excludeVariantId } : undefined },
      include: { options: true },
    });

    const key = (opts: { attributeId: string; optionId: string }[]) =>
      opts
        .map((o) => `${o.attributeId}:${o.optionId}`)
        .sort()
        .join("|");
    const newKey = key(options);

    const clash = existingVariants.some((variant) => key(variant.options) === newKey);
    if (clash) {
      throw new BadRequestException("Ya existe una variante con esa misma combinación de valores.");
    }
  }

  async createVariant(productId: string, dto: CreateProductVariantDto) {
    const product = await this.findOne(productId);
    const options = await this.buildVariantOptions(product.categoryId, dto.options);
    await this.assertVariantCombinationIsUnique(productId, options);
    const variantCode = await this.generateVariantCode();

    try {
      await this.prisma.productVariant.create({
        data: {
          productId,
          variantCode,
          purchasePrice: dto.purchasePrice,
          utility: dto.utility ?? 0,
          minPriceBs: dto.minPriceBs,
          discountBs: dto.discountBs ?? 0,
          options: { create: options },
        },
      });
      return this.findOne(productId);
    } catch (error) {
      rethrowPrismaError(error, "Variante de producto");
    }
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateProductVariantDto) {
    const product = await this.findOne(productId);
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) {
      throw new NotFoundException("Variante no encontrada.");
    }

    let options: { attributeId: string; optionId: string }[] | undefined;
    if (dto.options) {
      options = await this.buildVariantOptions(product.categoryId, dto.options);
      await this.assertVariantCombinationIsUnique(productId, options, variantId);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (options) {
          await tx.productVariantOption.deleteMany({ where: { variantId } });
          await tx.productVariantOption.createMany({ data: options.map((o) => ({ ...o, variantId })) });
        }
        await tx.productVariant.update({
          where: { id: variantId },
          data: {
            purchasePrice: dto.purchasePrice,
            utility: dto.utility,
            minPriceBs: dto.minPriceBs,
            discountBs: dto.discountBs,
          },
        });
      });
      return this.findOne(productId);
    } catch (error) {
      rethrowPrismaError(error, "Variante de producto");
    }
  }

  async removeVariant(productId: string, variantId: string) {
    const product = await this.findOne(productId);
    if (!product.variants.some((v) => v.id === variantId)) {
      throw new NotFoundException("Variante no encontrada.");
    }
    try {
      await this.prisma.productVariant.delete({ where: { id: variantId } });
    } catch (error) {
      rethrowPrismaError(error, "Variante de producto");
    }
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    try {
      await this.prisma.product.delete({ where: { id } });
      if (existing.imageUrl) {
        const filename = existing.imageUrl.split("/").pop();
        if (filename) {
          await unlink(join(PRODUCT_IMAGES_DIR, filename)).catch(() => {});
        }
      }
    } catch (error) {
      rethrowPrismaError(error, "Producto");
    }
  }
}
