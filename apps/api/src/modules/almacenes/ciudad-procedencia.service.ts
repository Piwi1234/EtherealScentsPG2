import { Injectable, NotFoundException } from "@nestjs/common";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreateCiudadProcedenciaDto } from "./dto/create-ciudad-procedencia.dto";
import { UpdateCiudadProcedenciaDto } from "./dto/update-ciudad-procedencia.dto";

/** Catálogo de ciudades de origen, todavía sin relaciones a otros modelos (uso futuro) — así que
 * desactivar no tiene ningún chequeo que bloquear, a diferencia de Almacen/Ciudad. */
@Injectable()
export class CiudadProcedenciaService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = getPagination({
      page: query.page ?? "1",
      pageSize: query.pageSize ?? "20",
    });

    const [items, total] = await Promise.all([
      this.prisma.ciudadProcedencia.findMany({ skip, take, orderBy: { nombre: "asc" } }),
      this.prisma.ciudadProcedencia.count(),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const ciudad = await this.prisma.ciudadProcedencia.findUnique({ where: { id } });
    if (!ciudad) {
      throw new NotFoundException("Ciudad de procedencia no encontrada.");
    }
    return ciudad;
  }

  async create(dto: CreateCiudadProcedenciaDto) {
    try {
      return await this.prisma.ciudadProcedencia.create({ data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Ciudad de procedencia");
    }
  }

  async update(id: string, dto: UpdateCiudadProcedenciaDto) {
    await this.findOne(id);
    try {
      return await this.prisma.ciudadProcedencia.update({ where: { id }, data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Ciudad de procedencia");
    }
  }

  /** Soft delete: marca activo = false. */
  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.ciudadProcedencia.update({ where: { id }, data: { activo: false } });
    } catch (error) {
      rethrowPrismaError(error, "Ciudad de procedencia");
    }
  }
}
