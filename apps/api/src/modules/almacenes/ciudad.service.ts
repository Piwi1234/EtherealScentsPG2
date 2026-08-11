import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreateCiudadDto } from "./dto/create-ciudad.dto";
import { UpdateCiudadDto } from "./dto/update-ciudad.dto";

@Injectable()
export class CiudadService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = getPagination({
      page: query.page ?? "1",
      pageSize: query.pageSize ?? "20",
    });

    const [items, total] = await Promise.all([
      this.prisma.ciudad.findMany({ skip, take, orderBy: { nombre: "asc" } }),
      this.prisma.ciudad.count(),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const ciudad = await this.prisma.ciudad.findUnique({ where: { id } });
    if (!ciudad) {
      throw new NotFoundException("Ciudad no encontrada.");
    }
    return ciudad;
  }

  async create(dto: CreateCiudadDto) {
    try {
      return await this.prisma.ciudad.create({ data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Ciudad");
    }
  }

  async update(id: string, dto: UpdateCiudadDto) {
    await this.findOne(id);
    try {
      return await this.prisma.ciudad.update({ where: { id }, data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Ciudad");
    }
  }

  /** Borrado real (no soft delete): Ciudad ya no es requisito de nada (Almacen dejó de referenciarla),
   * así que solo queda bloquear si todavía hay Clientes o Proformas apuntándole. */
  async remove(id: string) {
    await this.findOne(id);

    const clienteConCiudad = await this.prisma.cliente.findFirst({ where: { ciudadId: id } });
    if (clienteConCiudad) {
      throw new ConflictException("No se puede eliminar: hay clientes con esta ciudad asignada.");
    }

    const proformaConCiudad = await this.prisma.proforma.findFirst({ where: { ciudadEntregaId: id } });
    if (proformaConCiudad) {
      throw new ConflictException("No se puede eliminar: hay proformas con esta ciudad de entrega.");
    }

    try {
      return await this.prisma.ciudad.delete({ where: { id } });
    } catch (error) {
      rethrowPrismaError(error, "Ciudad");
    }
  }
}
