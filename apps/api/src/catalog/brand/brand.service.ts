import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { slugify } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { deleteFromR2 } from "../../common/r2-storage";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";

const includeCategories = {
  categories: { include: { category: true } },
} as const;

/** "ACQUA DI PARMA" -> "Acqua Di Parma": primera letra de cada palabra (separada por espacio) en
 * mayúscula, el resto en minúscula. Separadores que no son espacio (ej. "&" en "Dolce & Gabbana")
 * quedan tal cual, no cuentan como una palabra propia. */
function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  /** Una marca solo se asigna a subcategorías (categorías con padre), no a categorías raíz. */
  private async assertCategoriesExist(categoryIds: string[]) {
    if (categoryIds.length === 0) return;
    const found = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, parentId: true },
    });
    const foundIds = new Set(found.map((c) => c.id));
    const missing = categoryIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Categorías inexistentes: ${missing.join(", ")}`);
    }

    const notSubcategories = found.filter((c) => c.parentId === null);
    if (notSubcategories.length > 0) {
      throw new BadRequestException(
        `Una marca solo puede asignarse a subcategorías: ${notSubcategories.map((c) => c.name).join(", ")} no tiene categoría padre.`,
      );
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

  /** Vista previa de "Normalizar mayúsculas" — solo las marcas cuyo nombre cambiaría, para que se
   * revisen antes de aplicar (ej. siglas como "BDK"/"UFC" quedan "Bdk"/"Ufc", capaz no se quieren
   * así — se corrigen a mano después desde Editar si hace falta). */
  async previewNormalizeCase() {
    const brands = await this.prisma.brand.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
    return brands
      .map((b) => ({ id: b.id, oldName: b.name, newName: titleCase(b.name) }))
      .filter((b) => b.oldName !== b.newName);
  }

  async applyNormalizeCase() {
    const brands = await this.prisma.brand.findMany({ select: { id: true, name: true } });
    const toUpdate = brands
      .map((b) => ({ id: b.id, oldName: b.name, newName: titleCase(b.name) }))
      .filter((b) => b.oldName !== b.newName);

    await this.prisma.$transaction(
      toUpdate.map((b) => this.prisma.brand.update({ where: { id: b.id }, data: { name: b.newName } })),
    );

    return { updated: toUpdate.length };
  }

  async setLogo(id: string, file: Express.Multer.File) {
    const existing = await this.findOne(id);

    try {
      const updated = await this.prisma.brand.update({
        where: { id },
        // file.filename ya es la URL pública completa de R2 (ver WebpUploadInterceptor).
        data: { logoUrl: file.filename },
        include: includeCategories,
      });

      // Best-effort: borra el logo anterior para no acumular huérfanos en R2.
      if (existing.logoUrl) {
        await deleteFromR2(existing.logoUrl).catch(() => {});
      }

      return updated;
    } catch (error) {
      rethrowPrismaError(error, "Marca");
    }
  }
}
