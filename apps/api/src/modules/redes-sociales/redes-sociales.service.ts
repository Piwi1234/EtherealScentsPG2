import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { deleteFromR2 } from "../../common/r2-storage";
import { CreateRedSocialDto } from "./dto/create-red-social.dto";
import { UpdateRedSocialDto } from "./dto/update-red-social.dto";

@Injectable()
export class RedesSocialesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.redSocial.findMany({ orderBy: { createdAt: "asc" } });
  }

  async findOne(id: string) {
    const redSocial = await this.prisma.redSocial.findUnique({ where: { id } });
    if (!redSocial) {
      throw new NotFoundException("Red social no encontrada.");
    }
    return redSocial;
  }

  async create(dto: CreateRedSocialDto) {
    try {
      return await this.prisma.redSocial.create({ data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Red social");
    }
  }

  async update(id: string, dto: UpdateRedSocialDto) {
    await this.findOne(id);
    try {
      return await this.prisma.redSocial.update({ where: { id }, data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Red social");
    }
  }

  async setLogo(id: string, file: Express.Multer.File) {
    const existing = await this.findOne(id);

    try {
      const updated = await this.prisma.redSocial.update({
        where: { id },
        // file.filename ya es la URL pública completa de R2 (ver WebpUploadInterceptor).
        data: { logoUrl: file.filename },
      });

      // Best-effort: borra el logo anterior para no acumular huérfanos en R2.
      if (existing.logoUrl) {
        await deleteFromR2(existing.logoUrl).catch(() => {});
      }

      return updated;
    } catch (error) {
      rethrowPrismaError(error, "Red social");
    }
  }

  /** Ficha completa: se borra del todo (sin activo/soft-delete). */
  async remove(id: string) {
    const existing = await this.findOne(id);
    try {
      await this.prisma.redSocial.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, "Red social");
    }

    if (existing.logoUrl) {
      await deleteFromR2(existing.logoUrl).catch(() => {});
    }
  }
}
