import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { OrigenCliente, Prisma, TipoCliente } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreateClienteDto } from "./dto/create-cliente.dto";
import { UpdateClienteDto } from "./dto/update-cliente.dto";
import { QueryClienteDto } from "./dto/query-cliente.dto";

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * numeroDocumento y email son los campos clave para evitar duplicados. Reusable tal cual cuando
   * más adelante exista registro público desde la web (mismo chequeo, otro origen).
   */
  private async validarNoDuplicado(
    fields: { numeroDocumento?: string; email?: string },
    excludeId?: string,
  ) {
    const or: Prisma.ClienteWhereInput[] = [];
    if (fields.numeroDocumento) or.push({ numeroDocumento: fields.numeroDocumento });
    if (fields.email) or.push({ email: fields.email });
    if (or.length === 0) return;

    const existing = await this.prisma.cliente.findFirst({
      where: { OR: or, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    if (!existing) return;

    const campo =
      fields.numeroDocumento && existing.numeroDocumento === fields.numeroDocumento
        ? "número de documento"
        : "email";
    throw new ConflictException(`Ya existe un cliente registrado con ese ${campo}.`);
  }

  async findAll(query: QueryClienteDto) {
    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });

    const where: Prisma.ClienteWhereInput = {
      activo: query.activo,
      ...(query.search
        ? {
            OR: [
              { nombre: { contains: query.search, mode: "insensitive" } },
              { numeroDocumento: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.cliente.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
      this.prisma.cliente.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) {
      throw new NotFoundException("Cliente no encontrado.");
    }
    return cliente;
  }

  async create(dto: CreateClienteDto, creadoPorId: string) {
    await this.validarNoDuplicado({ numeroDocumento: dto.numeroDocumento, email: dto.email });
    try {
      return await this.prisma.cliente.create({
        data: {
          tipo: dto.tipo ?? TipoCliente.NATURAL,
          nombre: dto.nombre.trim(),
          tipoDocumento: dto.tipoDocumento,
          numeroDocumento: dto.numeroDocumento.trim(),
          email: dto.email?.trim().toLowerCase(),
          telefono: dto.telefono,
          direccion: dto.direccion,
          ciudad: dto.ciudad,
          ciudadId: dto.ciudadId,
          origen: OrigenCliente.MANUAL,
          creadoPorId,
        },
      });
    } catch (error) {
      rethrowPrismaError(error, "Cliente");
    }
  }

  async update(id: string, dto: UpdateClienteDto) {
    await this.findOne(id);
    if (dto.numeroDocumento !== undefined || dto.email !== undefined) {
      await this.validarNoDuplicado({ numeroDocumento: dto.numeroDocumento, email: dto.email }, id);
    }
    try {
      return await this.prisma.cliente.update({
        where: { id },
        data: {
          ...dto,
          numeroDocumento: dto.numeroDocumento?.trim(),
          email: dto.email?.trim().toLowerCase(),
        },
      });
    } catch (error) {
      rethrowPrismaError(error, "Cliente");
    }
  }

  /** Nunca se borra el registro: se deshabilita marcando activo = false. */
  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.cliente.update({ where: { id }, data: { activo: false } });
    } catch (error) {
      rethrowPrismaError(error, "Cliente");
    }
  }
}
