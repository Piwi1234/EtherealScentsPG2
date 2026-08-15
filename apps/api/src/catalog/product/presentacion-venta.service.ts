import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UnidadVariante } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { CreatePresentacionVentaDto, UpdatePresentacionVentaDto } from "./dto/presentacion-venta.dto";

/**
 * Subvariantes con precio propio de una ProductVariant con unidad = ML (ver doc-comment de
 * PresentacionVenta en schema.prisma). CRUD simple sin delete duro — igual criterio que
 * TipoMovimientoService del módulo Contabilidad: naturaleza/cantidadMl inmutables, solo precio/activo
 * se editan.
 */
@Injectable()
export class PresentacionVentaService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertVarianteFraccionable(varianteId: string) {
    const variante = await this.prisma.productVariant.findUnique({ where: { id: varianteId } });
    if (!variante) {
      throw new NotFoundException("Variante no encontrada.");
    }
    if (variante.unidad !== UnidadVariante.ML) {
      throw new BadRequestException("Esta variante no es de unidad ML — no admite presentaciones de venta.");
    }
    return variante;
  }

  async findAll(varianteId: string) {
    await this.assertVarianteFraccionable(varianteId);
    return this.prisma.presentacionVenta.findMany({ where: { varianteId }, orderBy: { cantidadMl: "asc" } });
  }

  async create(varianteId: string, dto: CreatePresentacionVentaDto) {
    await this.assertVarianteFraccionable(varianteId);
    try {
      return await this.prisma.presentacionVenta.create({
        data: { varianteId, cantidadMl: dto.cantidadMl, precioVentaBs: dto.precioVentaBs },
      });
    } catch (error) {
      rethrowPrismaError(error, "Presentación de venta");
    }
  }

  async update(id: string, dto: UpdatePresentacionVentaDto) {
    const existing = await this.prisma.presentacionVenta.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Presentación no encontrada.");
    }
    try {
      return await this.prisma.presentacionVenta.update({
        where: { id },
        data: { precioVentaBs: dto.precioVentaBs, activo: dto.activo },
      });
    } catch (error) {
      rethrowPrismaError(error, "Presentación de venta");
    }
  }
}
