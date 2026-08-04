import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AttributeType, AttributeVariantMode } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CategoryService } from "../category/category.service";
import { CreateAttributeDto } from "./dto/create-attribute.dto";
import { UpdateAttributeDto } from "./dto/update-attribute.dto";
import { CreateAttributeOptionDto, UpdateAttributeOptionDto } from "./dto/attribute-option.dto";

@Injectable()
export class AttributeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoryService,
  ) {}

  private validateOptionsForType(type: AttributeType, variantMode: AttributeVariantMode | undefined, options?: string[]) {
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

  async create(categoryId: string, dto: CreateAttributeDto) {
    await this.categories.findOne(categoryId);
    this.validateVariantMode(dto.type, dto.variantMode);
    this.validateOptionsForType(dto.type, dto.variantMode, dto.options);

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
          variantMode,
          options: isPlainSelect ? { create: dto.options!.map((value) => ({ value })) } : undefined,
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
    await this.findOne(id);
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
      return await this.prisma.attributeOption.create({ data: { attributeId, value: dto.value } });
    } catch (error) {
      rethrowPrismaError(error, "Opción de atributo");
    }
  }

  async updateOption(attributeId: string, optionId: string, dto: UpdateAttributeOptionDto) {
    const attribute = await this.findOne(attributeId);
    this.assertPlainSelectAttribute(attribute);
    await this.getOptionOrThrow(attributeId, optionId);
    try {
      return await this.prisma.attributeOption.update({ where: { id: optionId }, data: { value: dto.value } });
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
