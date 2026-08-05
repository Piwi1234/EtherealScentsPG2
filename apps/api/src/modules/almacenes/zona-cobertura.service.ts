import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreateZonaCoberturaDto } from "./dto/create-zona-cobertura.dto";
import { UpdateZonaCoberturaDto } from "./dto/update-zona-cobertura.dto";

@Injectable()
export class ZonaCoberturaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ordenadas por prioridad ascendente (1 = más cercano) — el orden que usa el motor de reparto. */
  async findAll(ciudadId?: string) {
    return this.prisma.zonaCobertura.findMany({
      where: { ciudadId },
      orderBy: [{ ciudadId: "asc" }, { prioridad: "asc" }],
      include: { almacen: true, ciudad: true },
    });
  }

  private async getOrThrow(ciudadId: string, almacenId: string) {
    const zona = await this.prisma.zonaCobertura.findUnique({
      where: { ciudadId_almacenId: { ciudadId, almacenId } },
    });
    if (!zona) {
      throw new NotFoundException("Zona de cobertura no encontrada.");
    }
    return zona;
  }

  async create(dto: CreateZonaCoberturaDto) {
    try {
      return await this.prisma.zonaCobertura.create({
        data: dto,
        include: { almacen: true, ciudad: true },
      });
    } catch (error) {
      rethrowPrismaError(error, "Zona de cobertura");
    }
  }

  async update(ciudadId: string, almacenId: string, dto: UpdateZonaCoberturaDto) {
    await this.getOrThrow(ciudadId, almacenId);
    try {
      return await this.prisma.zonaCobertura.update({
        where: { ciudadId_almacenId: { ciudadId, almacenId } },
        data: { prioridad: dto.prioridad },
        include: { almacen: true, ciudad: true },
      });
    } catch (error) {
      rethrowPrismaError(error, "Zona de cobertura");
    }
  }

  async remove(ciudadId: string, almacenId: string) {
    await this.getOrThrow(ciudadId, almacenId);
    try {
      await this.prisma.zonaCobertura.delete({ where: { ciudadId_almacenId: { ciudadId, almacenId } } });
    } catch (error) {
      rethrowPrismaError(error, "Zona de cobertura");
    }
  }
}
