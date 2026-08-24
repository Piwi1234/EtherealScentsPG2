import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
import type { CarouselKind } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { CAROUSEL_IMAGES_DIR } from "./carousel-image.multer";

/**
 * CRUD genérico sobre CarouselImage, agnóstico de a qué carrusel pertenece: `categoryId: null` es
 * el carrusel del Hero (singleton, `kind` no importa); `categoryId: <id>` es el de una categoría
 * raíz puntual, y `kind` distingue cuál de sus dos carruseles independientes es (FEATURE: bloque
 * "Producto destacado" del home; CATEGORY_HERO: hero de /categoria/[id], compartido con sus
 * subcategorías). Quien llama (CategoryService para categorías, SettingsController para el Hero) es
 * responsable de validar el permiso/contexto antes de llamar acá (ej. "solo categorías raíz").
 */
@Injectable()
export class CarouselImageService {
  constructor(private readonly prisma: PrismaService) {}

  list(categoryId: string | null, kind: CarouselKind) {
    return this.prisma.carouselImage.findMany({ where: { categoryId, kind }, orderBy: { orden: "asc" } });
  }

  async add(categoryId: string | null, kind: CarouselKind, file: Express.Multer.File) {
    const last = await this.prisma.carouselImage.findFirst({ where: { categoryId, kind }, orderBy: { orden: "desc" } });
    return this.prisma.carouselImage.create({
      data: { categoryId, kind, imageUrl: `/uploads/carousel/${file.filename}`, orden: (last?.orden ?? -1) + 1 },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.carouselImage.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Imagen no encontrada.");
    }
    await this.prisma.carouselImage.delete({ where: { id } });

    // Best-effort: borra el archivo para no acumular huérfanos en disco.
    const filename = existing.imageUrl.split("/").pop();
    if (filename) {
      await unlink(join(CAROUSEL_IMAGES_DIR, filename)).catch(() => {});
    }
  }

  /** Intercambia el `orden` con la imagen vecina en esa dirección — no-op si ya está en la punta. */
  async move(id: string, direction: "up" | "down") {
    const current = await this.prisma.carouselImage.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException("Imagen no encontrada.");
    }

    const neighbor = await this.prisma.carouselImage.findFirst({
      where: {
        categoryId: current.categoryId,
        kind: current.kind,
        orden: direction === "up" ? { lt: current.orden } : { gt: current.orden },
      },
      orderBy: { orden: direction === "up" ? "desc" : "asc" },
    });
    if (!neighbor) return;

    await this.prisma.$transaction([
      this.prisma.carouselImage.update({ where: { id: current.id }, data: { orden: neighbor.orden } }),
      this.prisma.carouselImage.update({ where: { id: neighbor.id }, data: { orden: current.orden } }),
    ]);
  }
}
