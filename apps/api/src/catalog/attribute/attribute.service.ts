import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AttributeType } from "@app/database";
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

  private validateOptionsForType(type: AttributeType, options?: string[]) {
    if (type === AttributeType.SELECT) {
      if (!options || options.length === 0) {
        throw new BadRequestException("Un atributo de tipo 'select' necesita al menos una opción.");
      }
    } else if (options && options.length > 0) {
      throw new BadRequestException("Las opciones solo aplican a atributos de tipo 'select'.");
    }
  }

  async create(categoryId: string, dto: CreateAttributeDto) {
    await this.categories.findOne(categoryId);
    this.validateOptionsForType(dto.type, dto.options);

    try {
      return await this.prisma.attribute.create({
        data: {
          categoryId,
          name: dto.name,
          type: dto.type,
          isFilterable: dto.isFilterable ?? false,
          isRequired: dto.isRequired ?? false,
          options: dto.type === AttributeType.SELECT ? { create: dto.options!.map((value) => ({ value })) } : undefined,
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

  async addOption(attributeId: string, dto: CreateAttributeOptionDto) {
    const attribute = await this.findOne(attributeId);
    if (attribute.type !== AttributeType.SELECT) {
      throw new BadRequestException("Solo los atributos de tipo 'select' admiten opciones.");
    }
    try {
      return await this.prisma.attributeOption.create({ data: { attributeId, value: dto.value } });
    } catch (error) {
      rethrowPrismaError(error, "Opción de atributo");
    }
  }

  async updateOption(attributeId: string, optionId: string, dto: UpdateAttributeOptionDto) {
    await this.getOptionOrThrow(attributeId, optionId);
    try {
      return await this.prisma.attributeOption.update({ where: { id: optionId }, data: { value: dto.value } });
    } catch (error) {
      rethrowPrismaError(error, "Opción de atributo");
    }
  }

  async removeOption(attributeId: string, optionId: string) {
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
