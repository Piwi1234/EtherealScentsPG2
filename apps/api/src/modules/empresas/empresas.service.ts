import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreateEmpresaDto } from "./dto/create-empresa.dto";
import { UpdateEmpresaDto } from "./dto/update-empresa.dto";
import { EMPRESA_LOGOS_DIR } from "./empresa-logo.multer";

@Injectable()
export class EmpresasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = getPagination({
      page: query.page ?? "1",
      pageSize: query.pageSize ?? "20",
    });

    const [items, total] = await Promise.all([
      this.prisma.empresa.findMany({ skip, take, orderBy: { createdAt: "desc" } }),
      this.prisma.empresa.count(),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const empresa = await this.prisma.empresa.findUnique({ where: { id } });
    if (!empresa) {
      throw new NotFoundException("Empresa no encontrada.");
    }
    return empresa;
  }

  async create(dto: CreateEmpresaDto) {
    try {
      return await this.prisma.empresa.create({ data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Empresa");
    }
  }

  async update(id: string, dto: UpdateEmpresaDto) {
    await this.findOne(id);
    try {
      return await this.prisma.empresa.update({ where: { id }, data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Empresa");
    }
  }

  async setLogo(id: string, file: Express.Multer.File) {
    const existing = await this.findOne(id);

    try {
      const updated = await this.prisma.empresa.update({
        where: { id },
        data: { logoUrl: `/uploads/empresas/${file.filename}` },
      });

      // Best-effort: borra el logo anterior para no acumular huérfanos en disco.
      if (existing.logoUrl) {
        const previousFilename = existing.logoUrl.split("/").pop();
        if (previousFilename) {
          await unlink(join(EMPRESA_LOGOS_DIR, previousFilename)).catch(() => {});
        }
      }

      return updated;
    } catch (error) {
      rethrowPrismaError(error, "Empresa");
    }
  }

  /** Nunca se borra el registro: se deshabilita marcando activo = false. */
  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.empresa.update({ where: { id }, data: { activo: false } });
    } catch (error) {
      rethrowPrismaError(error, "Empresa");
    }
  }
}
