import { Injectable } from "@nestjs/common";
import { hash } from "bcryptjs";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreateUsuarioDto } from "./dto/create-usuario.dto";
import { UpdateUsuarioDto } from "./dto/update-usuario.dto";

const SALT_ROUNDS = 12;

const publicSelect = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  activo: true,
  ultimoLogin: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { page?: string; pageSize?: string }) {
    const { page, pageSize, skip, take } = getPagination({
      page: query.page ?? "1",
      pageSize: query.pageSize ?? "20",
    });

    const [items, total] = await Promise.all([
      this.prisma.usuario.findMany({ skip, take, orderBy: { createdAt: "desc" }, select: publicSelect }),
      this.prisma.usuario.count(),
    ]);

    return { items, total, page, pageSize };
  }

  async create(dto: CreateUsuarioDto) {
    const passwordHash = await hash(dto.password, SALT_ROUNDS);
    try {
      return await this.prisma.usuario.create({
        data: {
          nombre: dto.nombre.trim(),
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          rol: dto.rol,
        },
        select: publicSelect,
      });
    } catch (error) {
      rethrowPrismaError(error, "Usuario");
    }
  }

  async update(id: string, dto: UpdateUsuarioDto) {
    const { password, ...rest } = dto;
    try {
      return await this.prisma.usuario.update({
        where: { id },
        data: {
          ...rest,
          email: rest.email?.trim().toLowerCase(),
          ...(password ? { passwordHash: await hash(password, SALT_ROUNDS) } : {}),
        },
        select: publicSelect,
      });
    } catch (error) {
      rethrowPrismaError(error, "Usuario");
    }
  }

  /** Nunca se borra el registro: se deshabilita el acceso marcando activo = false. */
  async remove(id: string) {
    try {
      return await this.prisma.usuario.update({
        where: { id },
        data: { activo: false },
        select: publicSelect,
      });
    } catch (error) {
      rethrowPrismaError(error, "Usuario");
    }
  }
}
