import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreateProveedorDto } from "./dto/create-proveedor.dto";
import { UpdateProveedorDto } from "./dto/update-proveedor.dto";

const include = { paisProcedencia: true } as const;

@Injectable()
export class ProveedoresService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertPaisProcedenciaExists(id: string) {
    const pais = await this.prisma.paisProcedencia.findUnique({ where: { id } });
    if (!pais) throw new BadRequestException(`paisProcedenciaId inválido: ${id}`);
  }

  async findAll(query: { page?: string; pageSize?: string; activo?: string }) {
    const { page, pageSize, skip, take } = getPagination({
      page: query.page ?? "1",
      pageSize: query.pageSize ?? "20",
    });

    const where = query.activo !== undefined ? { activo: query.activo === "true" } : {};

    const [items, total] = await Promise.all([
      this.prisma.proveedor.findMany({ where, skip, take, orderBy: { nombre: "asc" }, include }),
      this.prisma.proveedor.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const proveedor = await this.prisma.proveedor.findUnique({ where: { id }, include });
    if (!proveedor) {
      throw new NotFoundException("Proveedor no encontrado.");
    }
    return proveedor;
  }

  async create(dto: CreateProveedorDto) {
    await this.assertPaisProcedenciaExists(dto.paisProcedenciaId);
    try {
      return await this.prisma.proveedor.create({ data: dto, include });
    } catch (error) {
      rethrowPrismaError(error, "Proveedor");
    }
  }

  async update(id: string, dto: UpdateProveedorDto) {
    await this.findOne(id);
    if (dto.paisProcedenciaId) await this.assertPaisProcedenciaExists(dto.paisProcedenciaId);
    try {
      return await this.prisma.proveedor.update({ where: { id }, data: dto, include });
    } catch (error) {
      rethrowPrismaError(error, "Proveedor");
    }
  }

  /** Soft delete: marca activo = false. */
  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.proveedor.update({ where: { id }, data: { activo: false }, include });
    } catch (error) {
      rethrowPrismaError(error, "Proveedor");
    }
  }
}
