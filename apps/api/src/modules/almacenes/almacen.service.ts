import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreateAlmacenDto } from "./dto/create-almacen.dto";
import { UpdateAlmacenDto } from "./dto/update-almacen.dto";

@Injectable()
export class AlmacenService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = getPagination({
      page: query.page ?? "1",
      pageSize: query.pageSize ?? "20",
    });

    const [items, total] = await Promise.all([
      this.prisma.almacen.findMany({ skip, take, orderBy: { nombre: "asc" } }),
      this.prisma.almacen.count(),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const almacen = await this.prisma.almacen.findUnique({ where: { id } });
    if (!almacen) {
      throw new NotFoundException("Almacén no encontrado.");
    }
    return almacen;
  }

  async create(dto: CreateAlmacenDto) {
    try {
      return await this.prisma.almacen.create({ data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Almacén");
    }
  }

  async update(id: string, dto: UpdateAlmacenDto) {
    await this.findOne(id);
    try {
      return await this.prisma.almacen.update({ where: { id }, data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Almacén");
    }
  }

  /**
   * Soft delete, pero además bloquea desactivar un almacén con stock físico > 0 o con proformas
   * activas apuntándole — el Restrict de la FK solo protege contra hard-delete, no contra esto.
   */
  async remove(id: string) {
    await this.findOne(id);

    const stockConExistencias = await this.prisma.stock.findFirst({
      where: { almacenId: id, cantidadFisica: { gt: 0 } },
    });
    if (stockConExistencias) {
      throw new ConflictException("No se puede desactivar: el almacén todavía tiene stock físico.");
    }

    const proformaActiva = await this.prisma.proforma.findFirst({
      where: {
        estado: "APROBADA",
        OR: [{ almacenId: id }, { detalles: { some: { asignaciones: { some: { almacenId: id } } } } }],
      },
    });
    if (proformaActiva) {
      throw new ConflictException("No se puede desactivar: el almacén tiene proformas aprobadas pendientes de completar.");
    }

    try {
      return await this.prisma.almacen.update({ where: { id }, data: { activo: false } });
    } catch (error) {
      rethrowPrismaError(error, "Almacén");
    }
  }
}
