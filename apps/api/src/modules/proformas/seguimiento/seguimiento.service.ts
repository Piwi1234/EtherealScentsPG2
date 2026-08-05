import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoProforma, EstadoSeguimiento, Prisma } from "@app/database";
import { getPagination } from "@app/shared";
import { PrismaService } from "../../../common/prisma.service";
import { CreateSeguimientoDto } from "./dto/create-seguimiento.dto";
import { QuerySeguimientoDto } from "./dto/query-seguimiento.dto";

const ESTADOS_CON_SEGUIMIENTO: EstadoProforma[] = [EstadoProforma.APROBADA, EstadoProforma.COMPLETADA];

/** Mismo shape que necesitan AtributosVisibles/VarianteSelector/ProformaDetalleTable en el frontend,
 * reusado acá para que cada línea se pueda mostrar igual que dentro de su proforma. */
const includeLinea = {
  proforma: {
    select: {
      id: true,
      tipo: true,
      estado: true,
      fecha: true,
      empresa: { select: { id: true, nombre: true } },
      cliente: { select: { id: true, nombre: true } },
      almacenRecepcion: { select: { id: true, nombre: true } },
    },
  },
  variante: {
    include: {
      product: { include: { attributeValues: { include: { attribute: true, option: true } }, brand: true } },
      options: { include: { optionValue: { include: { attribute: true } } } },
    },
  },
  seguimientos: {
    orderBy: { fecha: "desc" as const },
    include: { usuario: { select: { id: true, nombre: true } } },
  },
} satisfies Prisma.ProformaDetalleInclude;

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

  /**
   * Todas las líneas con seguimiento habilitado (proforma APROBADA o COMPLETADA), sin importar de
   * qué proforma vengan — la vista operativa de "qué tengo pendiente de comprar/enviar/recibir hoy".
   * `estadoActual` no es una columna: es la fila más reciente de `seguimientos` (o PENDIENTE si
   * todavía no se registró ninguna), así que el filtro por estado se resuelve en memoria después de
   * traer las líneas — volumen manejable para esta escala (proformas aprobadas, no todo el historial).
   */
  async findPendientes(query: QuerySeguimientoDto) {
    const where: Prisma.ProformaDetalleWhereInput = {
      proforma: { estado: { in: ESTADOS_CON_SEGUIMIENTO }, tipo: query.tipo, empresaId: query.empresaId },
    };

    const detalles = await this.prisma.proformaDetalle.findMany({
      where,
      orderBy: { proforma: { fecha: "asc" } },
      include: includeLinea,
    });

    const conEstado = detalles.map((detalle) => ({
      ...detalle,
      estadoActual: detalle.seguimientos[0]?.estado ?? EstadoSeguimiento.PENDIENTE,
    }));
    const filtrados = query.estado ? conEstado.filter((d) => d.estadoActual === query.estado) : conEstado;

    const { page, pageSize, skip, take } = getPagination({
      page: String(query.page ?? 1),
      pageSize: String(query.limit ?? 20),
    });

    return { items: filtrados.slice(skip, skip + take), total: filtrados.length, page, pageSize };
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
