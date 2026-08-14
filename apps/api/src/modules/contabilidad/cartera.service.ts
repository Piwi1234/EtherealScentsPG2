import { Injectable, NotFoundException } from "@nestjs/common";
import { MonedaCartera, Prisma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreateCarteraDto } from "./dto/create-cartera.dto";
import { UpdateCarteraDto } from "./dto/update-cartera.dto";

@Injectable()
export class CarteraService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: { moneda?: MonedaCartera; activo?: string }) {
    const where: Prisma.CarteraWhereInput = {
      moneda: query.moneda,
      activo: query.activo === undefined ? undefined : query.activo === "true",
    };
    return this.prisma.cartera.findMany({ where, orderBy: { nombre: "asc" } });
  }

  async findOne(id: string) {
    const cartera = await this.prisma.cartera.findUnique({ where: { id } });
    if (!cartera) {
      throw new NotFoundException("Cartera no encontrada.");
    }
    return cartera;
  }

  async create(dto: CreateCarteraDto) {
    try {
      return await this.prisma.cartera.create({ data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Cartera");
    }
  }

  async update(id: string, dto: UpdateCarteraDto) {
    await this.findOne(id);
    try {
      return await this.prisma.cartera.update({ where: { id }, data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Cartera");
    }
  }

  /** Soft delete: marca activo = false. Sin chequeos bloqueantes — a diferencia de Almacén no hay
   * ningún "físico" pendiente; el historial de movimientos queda intacto y visible igual. */
  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.cartera.update({ where: { id }, data: { activo: false } });
    } catch (error) {
      rethrowPrismaError(error, "Cartera");
    }
  }
}
