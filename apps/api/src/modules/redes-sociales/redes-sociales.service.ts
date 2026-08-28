import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreateRedSocialDto } from "./dto/create-red-social.dto";
import { UpdateRedSocialDto } from "./dto/update-red-social.dto";
import { RED_SOCIAL_LOGOS_DIR } from "./red-social-logo.multer";

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
        data: { logoUrl: `/uploads/redes-sociales/${file.filename}` },
      });

      // Best-effort: borra el logo anterior para no acumular huérfanos en disco.
      if (existing.logoUrl) {
        const previousFilename = existing.logoUrl.split("/").pop();
        if (previousFilename) {
          await unlink(join(RED_SOCIAL_LOGOS_DIR, previousFilename)).catch(() => {});
        }
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
      const filename = existing.logoUrl.split("/").pop();
      if (filename) {
        await unlink(join(RED_SOCIAL_LOGOS_DIR, filename)).catch(() => {});
      }
    }
  }
}
