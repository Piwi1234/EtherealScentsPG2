import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { slugify } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";

const includeCategories = {
  categories: { include: { category: true } },
} as const;

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCategoriesExist(categoryIds: string[]) {
    if (categoryIds.length === 0) return;
    const found = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((c) => c.id));
    const missing = categoryIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Categorías inexistentes: ${missing.join(", ")}`);
    }
  }

  async create(dto: CreateBrandDto) {
    const categoryIds = dto.categoryIds ?? [];
    await this.assertCategoriesExist(categoryIds);

    try {
      return await this.prisma.brand.create({
        data: {
          name: dto.name,
          slug: dto.slug ?? slugify(dto.name),
          categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        },
        include: includeCategories,
      });
    } catch (error) {
      rethrowPrismaError(error, "Marca");
    }
  }

  async findAll(options: { categoryId?: string } = {}) {
    return this.prisma.brand.findMany({
      where: options.categoryId ? { categories: { some: { categoryId: options.categoryId } } } : undefined,
      orderBy: { name: "asc" },
      include: includeCategories,
    });
  }

  async findOne(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id }, include: includeCategories });
    if (!brand) {
      throw new NotFoundException("Marca no encontrada.");
    }
    return brand;
  }

  async update(id: string, dto: UpdateBrandDto) {
    await this.findOne(id);

    if (dto.categoryIds) {
      await this.assertCategoriesExist(dto.categoryIds);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.categoryIds) {
          await tx.brandCategory.deleteMany({ where: { brandId: id } });
          if (dto.categoryIds.length > 0) {
            await tx.brandCategory.createMany({
              data: dto.categoryIds.map((categoryId) => ({ brandId: id, categoryId })),
            });
          }
        }

        return tx.brand.update({
          where: { id },
          data: { name: dto.name, slug: dto.slug },
          include: includeCategories,
        });
      });
    } catch (error) {
      rethrowPrismaError(error, "Marca");
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.brand.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, "Marca");
    }
  }
}
