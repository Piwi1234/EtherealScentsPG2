import { Injectable, NotFoundException } from "@nestjs/common";
import { NaturalezaMovimiento, Prisma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CarteraService } from "./cartera.service";
import { CreateTipoMovimientoDto } from "./dto/create-tipo-movimiento.dto";
import { UpdateTipoMovimientoDto } from "./dto/update-tipo-movimiento.dto";

@Injectable()
export class TipoMovimientoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carteras: CarteraService,
  ) {}

  async findAll(carteraId: string, query: { naturaleza?: NaturalezaMovimiento; activo?: string }) {
    await this.carteras.findOne(carteraId);
    const where: Prisma.TipoMovimientoWhereInput = {
      carteraId,
      naturaleza: query.naturaleza,
      activo: query.activo === undefined ? undefined : query.activo === "true",
    };
    return this.prisma.tipoMovimiento.findMany({ where, orderBy: { nombre: "asc" } });
  }

  private async findOne(id: string) {
    const tipo = await this.prisma.tipoMovimiento.findUnique({ where: { id } });
    if (!tipo) {
      throw new NotFoundException("Tipo de movimiento no encontrado.");
    }
    return tipo;
  }

  async create(carteraId: string, dto: CreateTipoMovimientoDto) {
    await this.carteras.findOne(carteraId);
    try {
      return await this.prisma.tipoMovimiento.create({ data: { ...dto, carteraId } });
    } catch (error) {
      rethrowPrismaError(error, "Tipo de movimiento");
    }
  }

  /** Solo nombre/activo — naturaleza es inmutable (ver doc-comment del DTO). */
  async update(id: string, dto: UpdateTipoMovimientoDto) {
    await this.findOne(id);
    try {
      return await this.prisma.tipoMovimiento.update({ where: { id }, data: dto });
    } catch (error) {
      rethrowPrismaError(error, "Tipo de movimiento");
    }
  }
}
