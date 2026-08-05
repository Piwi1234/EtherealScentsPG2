import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AttributeType, AttributeVariantMode } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CategoryService } from "../category/category.service";
import { generateUniqueEntityCode } from "../entity-code";
import { CreateAttributeDto, CreateAttributeOptionInputDto } from "./dto/create-attribute.dto";
import { UpdateAttributeDto } from "./dto/update-attribute.dto";
import { CreateAttributeOptionDto, UpdateAttributeOptionDto } from "./dto/attribute-option.dto";

@Injectable()
export class AttributeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoryService,
  ) {}

  private validateOptionsForType(
    type: AttributeType,
    variantMode: AttributeVariantMode | undefined,
    options?: CreateAttributeOptionInputDto[],
  ) {
    const isPlainSelect = type === AttributeType.SELECT && (variantMode ?? AttributeVariantMode.NONE) === AttributeVariantMode.NONE;
    if (isPlainSelect) {
      if (!options || options.length === 0) {
        throw new BadRequestException("Un atributo de tipo 'select' necesita al menos una opción.");
      }
      return;
    }
    if (options && options.length > 0) {
      if (type !== AttributeType.SELECT) {
        throw new BadRequestException("Las opciones solo aplican a atributos de tipo 'select'.");
      }
      throw new BadRequestException(
        "Los atributos con variantes (múltiples o con precio propio) no definen opciones al crearse: los valores se cargan por producto.",
      );
    }
  }

  private validateVariantMode(type: AttributeType, variantMode?: AttributeVariantMode) {
    if (variantMode && variantMode !== AttributeVariantMode.NONE && type !== AttributeType.SELECT) {
      throw new BadRequestException("Los atributos variables (múltiples o con precio propio) solo aplican a tipo 'select'.");
    }
  }

  /** allowMultiple solo tiene sentido para un select "normal" (sin variante): el producto elige 1+
   * de la lista compartida de la categoría. Para MULTI_VALUE/PRICED_VARIANT ya existe su propio
   * mecanismo (valores propios por producto). */
  private validateAllowMultiple(type: AttributeType, variantMode: AttributeVariantMode | undefined, allowMultiple?: boolean) {
    if (allowMultiple && (type !== AttributeType.SELECT || (variantMode ?? AttributeVariantMode.NONE) !== AttributeVariantMode.NONE)) {
      throw new BadRequestException("'allowMultiple' solo aplica a atributos de tipo 'select' sin variante.");
    }
  }

  async create(categoryId: string, dto: CreateAttributeDto) {
    await this.categories.findOne(categoryId);
    this.validateVariantMode(dto.type, dto.variantMode);
    this.validateOptionsForType(dto.type, dto.variantMode, dto.options);
    this.validateAllowMultiple(dto.type, dto.variantMode, dto.allowMultiple);

    const variantMode = dto.variantMode ?? AttributeVariantMode.NONE;
    const isPlainSelect = dto.type === AttributeType.SELECT && variantMode === AttributeVariantMode.NONE;

    try {
      return await this.prisma.attribute.create({
        data: {
          categoryId,
          name: dto.name,
          type: dto.type,
          isFilterable: dto.isFilterable ?? false,
          isRequired: dto.isRequired ?? false,
          showInProductList: dto.showInProductList ?? false,
          mostrarEnProforma: dto.mostrarEnProforma ?? false,
          orden: dto.orden ?? 0,
          variantMode,
          allowMultiple: isPlainSelect ? (dto.allowMultiple ?? false) : false,
          options: isPlainSelect
            ? { create: dto.options!.map((o) => ({ value: o.value, color: o.color })) }
            : undefined,
        },
        include: { options: true },
      });
    } catch (error) {
      rethrowPrismaError(error, "Atributo");
    }
  }

  /** Atributos propios de la categoría más los heredados de sus categorías ancestras. */
  async listForCategory(categoryId: string, includeInherited = true) {
    const categoryIds = includeInherited ? await this.categories.getAncestorChain(categoryId) : [categoryId];

    const attributes = await this.prisma.attribute.findMany({
      where: { categoryId: { in: categoryIds } },
      include: { options: true },
      orderBy: { name: "asc" },
    });

    return attributes.map((attribute) => ({
      ...attribute,
      inherited: attribute.categoryId !== categoryId,
    }));
  }

  async findOne(id: string) {
    const attribute = await this.prisma.attribute.findUnique({ where: { id }, include: { options: true } });
    if (!attribute) {
      throw new NotFoundException("Atributo no encontrado.");
    }
    return attribute;
  }

  async update(id: string, dto: UpdateAttributeDto) {
    const attribute = await this.findOne(id);
    if (dto.allowMultiple) {
      this.validateAllowMultiple(attribute.type, attribute.variantMode, dto.allowMultiple);
    }
    try {
      return await this.prisma.attribute.update({
        where: { id },
        data: dto,
        include: { options: true },
      });
    } catch (error) {
      rethrowPrismaError(error, "Atributo");
    }
  }

  /**
   * Migración dedicada MULTI_VALUE → PRICED_VARIANT: cada valor ya cargado por producto
   * (`ProductVariantOptionValue`, ej. cada sabor) pasa a tener su propia `ProductVariant` real (su
   * propio stock), en vez de compartir la variante "default" del producto. Esa variante default NO
   * se toca ni se borra — si tiene stock/lotes reales, queda para revisión manual (no hay forma
   * segura de saber a qué valor pertenece cada unidad ya cargada).
   */
  async convertirMultiValueAPrecioPropio(attributeId: string) {
    const attribute = await this.findOne(attributeId);
    if (attribute.type !== AttributeType.SELECT || attribute.variantMode !== AttributeVariantMode.MULTI_VALUE) {
      throw new BadRequestException("Este atributo no es de tipo múltiple (MULTI_VALUE) — no aplica esta conversión.");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.attribute.update({ where: { id: attributeId }, data: { variantMode: AttributeVariantMode.PRICED_VARIANT } });

      const valores = await tx.productVariantOptionValue.findMany({
        where: { attributeId },
        include: { product: true },
      });

      const productosAfectados = new Set<string>();
      for (const valor of valores) {
        const variantCode = await generateUniqueEntityCode(
          async (code) => (await tx.productVariant.findUnique({ where: { variantCode: code } })) !== null,
        );
        await tx.productVariant.create({
          data: {
            productId: valor.productId,
            variantCode,
            purchasePrice: valor.product.purchasePrice,
            utility: valor.product.utility,
            minPriceBs: valor.product.minPriceBs,
            discountBs: valor.product.discountBs,
            isDefault: false,
            options: { create: [{ optionValueId: valor.id }] },
          },
        });
        productosAfectados.add(valor.productId);
      }

      // Productos afectados cuya variante "default" (anterior a la conversión) todavía tiene stock
      // o lotes reales — ese stock no sabe a qué valor pertenece, hay que repartirlo a mano.
      const variantesDefault = await tx.productVariant.findMany({
        where: { productId: { in: Array.from(productosAfectados) }, isDefault: true },
        include: { product: { select: { name: true, productCode: true } } },
      });
      const productosConStockLegado: {
        productId: string;
        nombre: string;
        productCode: string;
        stockTotal: number;
        lotesActivos: number;
      }[] = [];
      for (const variante of variantesDefault) {
        const stock = await tx.stock.findMany({ where: { varianteId: variante.id }, select: { cantidadFisica: true } });
        const stockTotal = stock.reduce((sum, s) => sum + s.cantidadFisica, 0);
        const lotesActivos = await tx.loteCompra.count({ where: { varianteId: variante.id, cantidadDisponible: { gt: 0 } } });
        if (stockTotal > 0 || lotesActivos > 0) {
          productosConStockLegado.push({
            productId: variante.productId,
            nombre: variante.product.name,
            productCode: variante.product.productCode,
            stockTotal,
            lotesActivos,
          });
        }
      }

      return {
        productosAfectados: productosAfectados.size,
        variantesCreadas: valores.length,
        productosConStockLegado,
      };
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.attribute.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, "Atributo");
    }
  }

  /** Las opciones compartidas de categoría solo existen para atributos normales (variantMode NONE):
   * los de variante (múltiple o con precio propio) cargan sus valores por producto. */
  private assertPlainSelectAttribute(attribute: { variantMode: AttributeVariantMode }) {
    if (attribute.variantMode !== AttributeVariantMode.NONE) {
      throw new BadRequestException(
        "Este atributo tiene variantes: sus valores se cargan por producto (POST /products/:id/variant-options), no acá.",
      );
    }
  }

  async addOption(attributeId: string, dto: CreateAttributeOptionDto) {
    const attribute = await this.findOne(attributeId);
    if (attribute.type !== AttributeType.SELECT) {
      throw new BadRequestException("Solo los atributos de tipo 'select' admiten opciones.");
    }
    this.assertPlainSelectAttribute(attribute);
    try {
      return await this.prisma.attributeOption.create({ data: { attributeId, value: dto.value, color: dto.color } });
    } catch (error) {
      rethrowPrismaError(error, "Opción de atributo");
    }
  }

  async updateOption(attributeId: string, optionId: string, dto: UpdateAttributeOptionDto) {
    const attribute = await this.findOne(attributeId);
    this.assertPlainSelectAttribute(attribute);
    await this.getOptionOrThrow(attributeId, optionId);
    try {
      return await this.prisma.attributeOption.update({
        where: { id: optionId },
        data: { value: dto.value, color: dto.color },
      });
    } catch (error) {
      rethrowPrismaError(error, "Opción de atributo");
    }
  }

  async removeOption(attributeId: string, optionId: string) {
    const attribute = await this.findOne(attributeId);
    this.assertPlainSelectAttribute(attribute);
    await this.getOptionOrThrow(attributeId, optionId);
    try {
      await this.prisma.attributeOption.delete({ where: { id: optionId } });
    } catch (error) {
      rethrowPrismaError(error, "Opción de atributo");
    }
  }

  private async getOptionOrThrow(attributeId: string, optionId: string) {
    const option = await this.prisma.attributeOption.findFirst({ where: { id: optionId, attributeId } });
    if (!option) {
      throw new NotFoundException("Opción de atributo no encontrada.");
    }
    return option;
  }
}
