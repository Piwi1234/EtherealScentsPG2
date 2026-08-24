import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Category } from "@app/database";
import { slugify } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CarouselImageService } from "../carousel-image/carousel-image.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

const includeCarouselImages = {
  carouselImages: { orderBy: { orden: "asc" as const } },
};

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carouselImages: CarouselImageService,
  ) {}

  private hasCostFields(dto: { logisticsCost?: number; shippingCost?: number; securityCost?: number }) {
    return dto.logisticsCost !== undefined || dto.shippingCost !== undefined || dto.securityCost !== undefined;
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentId) {
      await this.findOne(dto.parentId);
    }
    if (this.hasCostFields(dto) && !dto.parentId) {
      throw new BadRequestException("Los costos logísticos solo se pueden definir en subcategorías.");
    }
    if (dto.comentario !== undefined && dto.parentId) {
      throw new BadRequestException("El comentario solo se puede definir en categorías raíz.");
    }

    try {
      return await this.prisma.category.create({
        data: {
          name: dto.name,
          slug: dto.slug ?? slugify(dto.name),
          parentId: dto.parentId,
          logisticsCost: dto.logisticsCost,
          shippingCost: dto.shippingCost,
          securityCost: dto.securityCost,
          comentario: dto.parentId ? undefined : dto.comentario,
        },
      });
    } catch (error) {
      rethrowPrismaError(error, "Categoría");
    }
  }

  async findAll(options: { tree?: boolean } = {}) {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: "asc" },
      include: includeCarouselImages,
    });

    if (!options.tree) {
      return categories;
    }

    return this.buildTree(categories);
  }

  private buildTree(categories: Category[]): CategoryTreeNode[] {
    const byId = new Map<string, CategoryTreeNode>(
      categories.map((category) => [category.id, { ...category, children: [] }]),
    );
    const roots: CategoryTreeNode[] = [];

    for (const category of byId.values()) {
      if (category.parentId) {
        const parent = byId.get(category.parentId);
        parent ? parent.children.push(category) : roots.push(category);
      } else {
        roots.push(category);
      }
    }

    return roots;
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { parent: true, children: true, ...includeCarouselImages },
    });
    if (!category) {
      throw new NotFoundException("Categoría no encontrada.");
    }
    return category;
  }

  /** Cadena de ids desde la categoría hasta la raíz, incluyendo la propia categoría. */
  async getAncestorChain(categoryId: string): Promise<string[]> {
    const chain: string[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category: { id: string; parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: { id: true, parentId: true },
      });
      if (!category) {
        if (chain.length === 0) {
          throw new NotFoundException("Categoría no encontrada.");
        }
        break;
      }
      chain.push(category.id);
      currentId = category.parentId;
    }

    return chain;
  }

  /** La categoría y todos sus ids descendientes (subcategorías en cualquier nivel). */
  async getDescendantIds(categoryId: string): Promise<string[]> {
    await this.findOne(categoryId);

    const all = await this.prisma.category.findMany({ select: { id: true, parentId: true } });
    const childrenByParent = new Map<string, string[]>();
    for (const category of all) {
      if (!category.parentId) continue;
      const siblings = childrenByParent.get(category.parentId) ?? [];
      siblings.push(category.id);
      childrenByParent.set(category.parentId, siblings);
    }

    const result: string[] = [];
    const stack = [categoryId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      result.push(current);
      stack.push(...(childrenByParent.get(current) ?? []));
    }
    return result;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.findOne(id);

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException("Una categoría no puede ser su propio padre.");
      }
      const ancestors = await this.getAncestorChain(dto.parentId);
      if (ancestors.includes(id)) {
        throw new BadRequestException("No se puede asignar como padre a una subcategoría de sí misma.");
      }
    }

    const effectiveParentId = dto.parentId !== undefined ? dto.parentId : existing.parentId;
    if (this.hasCostFields(dto) && !effectiveParentId) {
      throw new BadRequestException("Los costos logísticos solo se pueden definir en subcategorías.");
    }
    if (dto.comentario !== undefined && effectiveParentId) {
      throw new BadRequestException("El comentario solo se puede definir en categorías raíz.");
    }
    // Si deja de tener padre, no queda como categoría raíz con costos huérfanos.
    const clearingParent = dto.parentId === null;
    // Si pasa a tener padre (se vuelve subcategoría), no queda como subcategoría con un comentario huérfano.
    const becomingSubcategory = Boolean(dto.parentId);

    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          name: dto.name,
          slug: dto.slug,
          parentId: dto.parentId,
          logisticsCost: clearingParent ? null : dto.logisticsCost,
          shippingCost: clearingParent ? null : dto.shippingCost,
          securityCost: clearingParent ? null : dto.securityCost,
          comentario: becomingSubcategory ? null : dto.comentario,
        },
      });
    } catch (error) {
      rethrowPrismaError(error, "Categoría");
    }
  }

  /** Solo categorías raíz tienen carrusel — es el de la sección "Producto destacado" del home. */
  private async assertRootCategory(id: string) {
    const category = await this.findOne(id);
    if (category.parentId) {
      throw new BadRequestException("El carrusel de imágenes solo se puede definir en categorías raíz.");
    }
  }

  async listCarouselImages(id: string) {
    await this.findOne(id);
    return this.carouselImages.list(id);
  }

  async addCarouselImage(id: string, file: Express.Multer.File) {
    await this.assertRootCategory(id);
    return this.carouselImages.add(id, file);
  }

  async removeCarouselImage(id: string, imageId: string) {
    await this.assertRootCategory(id);
    return this.carouselImages.remove(imageId);
  }

  async moveCarouselImage(id: string, imageId: string, direction: "up" | "down") {
    await this.assertRootCategory(id);
    return this.carouselImages.move(imageId, direction);
  }

  async remove(id: string) {
    await this.findOne(id);

    const childrenCount = await this.prisma.category.count({ where: { parentId: id } });
    if (childrenCount > 0) {
      throw new ConflictException("No se puede eliminar una categoría que tiene subcategorías.");
    }

    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, "Categoría");
    }
  }
}
