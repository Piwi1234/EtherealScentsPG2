import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { CAROUSEL_IMAGES_DIR } from "./carousel-image.multer";

/**
 * CRUD genérico sobre CarouselImage, agnóstico de a qué carrusel pertenece: `categoryId: null` es
 * el carrusel del Hero (singleton), `categoryId: <id>` es el de una categoría raíz puntual. Quien
 * llama (CategoryService para categorías, SettingsController para el Hero) es responsable de
 * validar el permiso/contexto antes de llamar acá (ej. "solo categorías raíz").
 */
@Injectable()
export class CarouselImageService {
  constructor(private readonly prisma: PrismaService) {}

  list(categoryId: string | null) {
    return this.prisma.carouselImage.findMany({ where: { categoryId }, orderBy: { orden: "asc" } });
  }

  async add(categoryId: string | null, file: Express.Multer.File) {
    const last = await this.prisma.carouselImage.findFirst({ where: { categoryId }, orderBy: { orden: "desc" } });
    return this.prisma.carouselImage.create({
      data: { categoryId, imageUrl: `/uploads/carousel/${file.filename}`, orden: (last?.orden ?? -1) + 1 },
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
