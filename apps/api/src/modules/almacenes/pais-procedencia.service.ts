import { Injectable, NotFoundException } from "@nestjs/common";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreatePaisProcedenciaDto } from "./dto/create-pais-procedencia.dto";
import { UpdatePaisProcedenciaDto } from "./dto/update-pais-procedencia.dto";

/** Catálogo de países de origen, todavía sin relaciones a otros modelos (uso futuro) — así que
 * desactivar no tiene ningún chequeo que bloquear, a diferencia de Almacen/Ciudad. */
@Injectable()
export class PaisProcedenciaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = getPagination({
      page: query.page ?? "1",
      pageSize: query.pageSize ?? "20",
    });

    const [items, total] = await Promise.all([
      this.prisma.paisProcedencia.findMany({ skip, take, orderBy: { nombre: "asc" } }),
      this.prisma.paisProcedencia.count(),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const pais = await this.prisma.paisProcedencia.findUnique({ where: { id } });
    if (!pais) {
      throw new NotFoundException("País de procedencia no encontrado.");
    }
    return pais;
  }

  async create(dto: CreatePaisProcedenciaDto) {
    try {
      return await this.prisma.paisProcedencia.create({ data: dto });
    } catch (error) {
      rethrowPrismaError(error, "País de procedencia");
    }
  }

  async update(id: string, dto: UpdatePaisProcedenciaDto) {
    await this.findOne(id);
    try {
      return await this.prisma.paisProcedencia.update({ where: { id }, data: dto });
    } catch (error) {
      rethrowPrismaError(error, "País de procedencia");
    }
  }

  /** Soft delete: marca activo = false. */
  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.paisProcedencia.update({ where: { id }, data: { activo: false } });
    } catch (error) {
      rethrowPrismaError(error, "País de procedencia");
    }
  }
}
