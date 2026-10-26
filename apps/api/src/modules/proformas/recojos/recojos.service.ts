import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoEnvio, EstadoProforma, TipoProforma } from "@app/database";
import { PrismaService } from "../../../common/prisma.service";
import { rethrowPrismaError } from "../../../common/prisma-errors";
import { CreateRecojoDto } from "./dto/recojo.dto";

const recojoInclude = {
  creadoPor: { select: { id: true, nombre: true } },
  lineas: {
    include: {
      compraDetalle: { select: { id: true, variante: { select: { id: true, variantCode: true, product: { select: { name: true, brand: { select: { name: true } } } } } } } },
    },
  },
} as const;

/**
 * Recojos de una compra: cada retiro de mercadería del proveedor, con cantidades por línea y fecha. Es lo
 * que permite recoger por partes: lo que falta queda "por recoger" y se completa en otro recojo. Las
 * unidades recogidas hacen avanzar a "Recogido" lo que cubren (ventas y solicitudes; ver recojo.util.ts).
 */
@Injectable()
export class RecojosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Recojos de la compra más el resumen por línea (comprado / recogido / por recoger). */
  async listar(compraId: string) {
    const compra = await this.prisma.proforma.findUnique({
      where: { id: compraId },
      select: {
        tipo: true,
        estado: true,
        detalles: { select: { id: true, cantidad: true, recojoLineas: { select: { cantidad: true } } } },
      },
    });
    if (!compra) throw new NotFoundException("Compra no encontrada.");
    if (compra.tipo !== TipoProforma.COMPRA) throw new BadRequestException("Solo las compras tienen recojos.");

    const recojos = await this.prisma.recojo.findMany({ where: { compraId }, orderBy: { fecha: "desc" }, include: recojoInclude });
    const resumen = compra.detalles.map((d) => {
      const recogido = d.recojoLineas.reduce((n, r) => n + r.cantidad, 0);
      return { compraDetalleId: d.id, cantidad: d.cantidad, recogido, porRecoger: Math.max(0, d.cantidad - recogido) };
    });
    return { recojos, resumen };
  }

  async crear(compraId: string, dto: CreateRecojoDto, usuarioId: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          const rows = await tx.$queryRaw<{ estado: EstadoProforma; tipo: TipoProforma }[]>`
            SELECT "estado", "tipo" FROM "proformas" WHERE "id" = ${compraId}::uuid FOR UPDATE
          `;
          const lock = rows[0];
          if (!lock) throw new NotFoundException("Compra no encontrada.");
          if (lock.tipo !== TipoProforma.COMPRA) throw new BadRequestException("Solo las compras tienen recojos.");
          if (lock.estado !== EstadoProforma.APROBADA) {
            throw new ConflictException(
              lock.estado === EstadoProforma.BORRADOR ? "Aprobá la compra antes de registrar un recojo." : `La compra ya está ${lock.estado}.`,
            );
          }

          const detalles = await tx.proformaDetalle.findMany({
            where: { proformaId: compraId },
            select: { id: true, cantidad: true, recojoLineas: { select: { cantidad: true } } },
          });
          const porId = new Map(detalles.map((d) => [d.id, d]));

          // Una misma línea puede venir repetida: se suma antes de validar contra lo que falta.
          const pedidoPorLinea = new Map<string, number>();
          for (const l of dto.lineas) pedidoPorLinea.set(l.compraDetalleId, (pedidoPorLinea.get(l.compraDetalleId) ?? 0) + l.cantidad);

          for (const [detalleId, cantidad] of pedidoPorLinea) {
            const d = porId.get(detalleId);
            if (!d) throw new BadRequestException("Una de las líneas no pertenece a esta compra.");
            const recogido = d.recojoLineas.reduce((n, r) => n + r.cantidad, 0);
            const falta = d.cantidad - recogido;
            if (cantidad > falta) {
              throw new ConflictException(`A una línea solo le faltan ${falta} unidad(es) por recoger y quisiste registrar ${cantidad}.`);
            }
          }

          await tx.recojo.create({
            data: {
              compraId,
              fecha: dto.fecha ? new Date(dto.fecha) : undefined,
              nota: dto.nota?.trim() || undefined,
              creadoPorId: usuarioId,
              lineas: { create: Array.from(pedidoPorLinea.entries()).map(([compraDetalleId, cantidad]) => ({ compraDetalleId, cantidad })) },
            },
          });
        },
        { timeout: 15000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Recojo");
    }
    return this.listar(compraId);
  }

  /** Deshace un recojo cargado por error. No se puede si la compra ya viaja o llegó. */
  async anular(recojoId: string) {
    const recojo = await this.prisma.recojo.findUnique({
      where: { id: recojoId },
      select: {
        compraId: true,
        compra: { select: { estado: true } },
        lineas: { select: { compraDetalleId: true, cantidad: true } },
      },
    });
    if (!recojo) throw new NotFoundException("Recojo no encontrado.");
    if (recojo.compra.estado !== EstadoProforma.APROBADA) throw new ConflictException(`La compra ya está ${recojo.compra.estado}.`);

    // Lo recogido que quede tras deshacer este recojo tiene que seguir cubriendo lo que ya está en envíos.
    const detalles = await this.prisma.proformaDetalle.findMany({
      where: { id: { in: recojo.lineas.map((l) => l.compraDetalleId) } },
      select: {
        id: true,
        recojoLineas: { select: { cantidad: true } },
        envioItems: { where: { envio: { estado: { not: EstadoEnvio.ANULADO } } }, select: { cantidad: true } },
      },
    });
    for (const l of recojo.lineas) {
      const d = detalles.find((x) => x.id === l.compraDetalleId);
      if (!d) continue;
      const recogidoTras = d.recojoLineas.reduce((n, r) => n + r.cantidad, 0) - l.cantidad;
      const enEnvios = d.envioItems.reduce((n, r) => n + r.cantidad, 0);
      if (recogidoTras < enEnvios) {
        throw new ConflictException("Parte de lo recogido ya está en un envío: sacalo del envío antes de deshacer el recojo.");
      }
    }
    await this.prisma.recojo.delete({ where: { id: recojoId } });
    return this.listar(recojo.compraId);
  }
}
