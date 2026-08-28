import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreateCarritoWhatsappContactoDto } from "./dto/create-carrito-whatsapp-contacto.dto";
import { UpdateCarritoWhatsappContactoDto } from "./dto/update-carrito-whatsapp-contacto.dto";
import { CARRITO_WHATSAPP_IMAGENES_DIR } from "./carrito-whatsapp-imagen.multer";

@Injectable()
export class CarritoWhatsappService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.carritoWhatsappContacto.findMany({ orderBy: { createdAt: "desc" } });
  }

  async findOne(id: string) {
    const contacto = await this.prisma.carritoWhatsappContacto.findUnique({ where: { id } });
    if (!contacto) {
      throw new NotFoundException("Contacto no encontrado.");
    }
    return contacto;
  }

  async create(dto: CreateCarritoWhatsappContactoDto) {
    try {
      return await this.prisma.carritoWhatsappContacto.create({ data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Contacto");
    }
  }

  async update(id: string, dto: UpdateCarritoWhatsappContactoDto) {
    await this.findOne(id);
    try {
      return await this.prisma.carritoWhatsappContacto.update({ where: { id }, data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Contacto");
    }
  }

  async setImagen(id: string, file: Express.Multer.File) {
    const existing = await this.findOne(id);

    try {
      const updated = await this.prisma.carritoWhatsappContacto.update({
        where: { id },
        data: { imagenUrl: `/uploads/carrito-whatsapp/${file.filename}` },
      });

      // Best-effort: borra la imagen anterior para no acumular huérfanos en disco.
      if (existing.imagenUrl) {
        const previousFilename = existing.imagenUrl.split("/").pop();
        if (previousFilename) {
          await unlink(join(CARRITO_WHATSAPP_IMAGENES_DIR, previousFilename)).catch(() => {});
        }
      }

      return updated;
    } catch (error) {
      rethrowPrismaError(error, "Contacto");
    }
  }

  /** Ficha completa: se borra del todo (sin activo/soft-delete), como pidió el usuario. */
  async remove(id: string) {
    const existing = await this.findOne(id);
    try {
      await this.prisma.carritoWhatsappContacto.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, "Contacto");
    }

    if (existing.imagenUrl) {
      const filename = existing.imagenUrl.split("/").pop();
      if (filename) {
        await unlink(join(CARRITO_WHATSAPP_IMAGENES_DIR, filename)).catch(() => {});
      }
    }
  }
}
