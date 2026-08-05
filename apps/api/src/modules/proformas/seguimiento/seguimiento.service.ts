import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoProforma } from "@app/database";
import { PrismaService } from "../../../common/prisma.service";
import { CreateSeguimientoDto } from "./dto/create-seguimiento.dto";

/**
 * Seguimiento interno por línea (envío/recepción) — separado del flujo de aprobación. Nunca toca
 * Stock ni el estado de la Proforma. Log de solo-inserción: el estado "actual" es la fila más
 * reciente por fecha (mismo patrón que ProformaHistorial).
 */
@Injectable()
export class SeguimientoService {
  constructor(private readonly prisma: PrismaService) {}

  private async getDetalleOrThrow(detalleId: string) {
    const detalle = await this.prisma.proformaDetalle.findUnique({
      where: { id: detalleId },
      include: { proforma: true },
    });
    if (!detalle) {
      throw new NotFoundException("Línea de proforma no encontrada.");
    }
    return detalle;
  }

  async findAll(detalleId: string) {
    await this.getDetalleOrThrow(detalleId);
    return this.prisma.proformaDetalleSeguimiento.findMany({
      where: { proformaDetalleId: detalleId },
      orderBy: { fecha: "desc" },
      include: { usuario: { select: { id: true, nombre: true } } },
    });
  }

  async create(detalleId: string, dto: CreateSeguimientoDto, usuarioId: string) {
    const detalle = await this.getDetalleOrThrow(detalleId);
    const estadosPermitidos: EstadoProforma[] = [EstadoProforma.APROBADA, EstadoProforma.COMPLETADA];
    if (!estadosPermitidos.includes(detalle.proforma.estado)) {
      throw new BadRequestException(
        "El seguimiento solo aplica desde que la proforma está APROBADA (o ya COMPLETADA).",
      );
    }

    return this.prisma.proformaDetalleSeguimiento.create({
      data: { proformaDetalleId: detalleId, estado: dto.estado, nota: dto.nota, usuarioId },
      include: { usuario: { select: { id: true, nombre: true } } },
    });
  }
}
