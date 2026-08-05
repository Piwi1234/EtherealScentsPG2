import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoProforma, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { ProformaHistorialService } from "./proforma-historial.service";
import { ProformasService } from "./proformas.service";
import { lockStockRows, stockKey } from "./stock-lock.util";

/**
 * Motor de aprobación: bloqueo transaccional + reparto por cercanía + reservas (VENTA), transición
 * simple (COMPRA); y liberación de reservas al rechazar/anular una venta ya aprobada.
 *
 * Estrategia de locking: SELECT ... FOR UPDATE explícito vía $queryRaw dentro de
 * prisma.$transaction, no Serializable+reintento — la aprobación es un punto real de contención
 * (proformas concurrentes compitiendo por la misma variante+almacén) y los bloqueos pesimistas de
 * alcance mínimo son más simples de razonar que un loop de reintento optimista. READ COMMITTED (el
 * default de Postgres) alcanza: los FOR UPDATE/upsert explícitos ya dan la serialización correcta
 * para este patrón de acceso.
 */
@Injectable()
export class ProformaApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historial: ProformaHistorialService,
    private readonly proformas: ProformasService,
  ) {}

  async aprobar(id: string, usuarioId: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;

          const rows = await tx.$queryRaw<{ estado: EstadoProforma; tipo: TipoProforma }[]>`
            SELECT "estado", "tipo" FROM "proformas" WHERE "id" = ${id}::uuid FOR UPDATE
          `;
          const lock = rows[0];
          if (!lock) throw new NotFoundException("Proforma no encontrada.");
          if (lock.estado !== EstadoProforma.PENDIENTE) {
            throw new ConflictException(`No se puede aprobar: la proforma está en estado ${lock.estado}.`);
          }

          if (lock.tipo === TipoProforma.COMPRA) {
            await tx.proforma.update({ where: { id }, data: { estado: EstadoProforma.APROBADA } });
            await this.historial.registrar(tx, id, EstadoProforma.APROBADA, usuarioId);
            return;
          }

          await this.aprobarVenta(tx, id, usuarioId);
        },
        { timeout: 15000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }
    return this.proformas.findOne(id);
  }

  private async aprobarVenta(tx: Prisma.TransactionClient, id: string, usuarioId: string) {
    const proforma = await tx.proforma.findUniqueOrThrow({ where: { id }, include: { detalles: true } });
    if (proforma.detalles.length === 0) {
      throw new BadRequestException("La proforma no tiene líneas.");
    }
    if (!proforma.ciudadEntregaId) {
      throw new BadRequestException("Falta ciudadEntregaId: no se puede resolver el reparto por cercanía.");
    }

    const zonas = await tx.zonaCobertura.findMany({
      where: { ciudadId: proforma.ciudadEntregaId },
      orderBy: { prioridad: "asc" },
    });
    if (zonas.length === 0) {
      throw new BadRequestException("No hay almacenes con cobertura para la ciudad de entrega.");
    }
    const almacenesOrdenados = zonas.map((z) => z.almacenId);

    // Resolver TODOS los pares (variante, almacén) candidatos de TODAS las líneas antes de bloquear
    // nada — así el orden de lock es global a la proforma completa, no por línea.
    const paresSet = new Set<string>();
    for (const detalle of proforma.detalles) {
      for (const almacenId of almacenesOrdenados) {
        paresSet.add(stockKey(detalle.varianteId, almacenId));
      }
    }
    const pares = [...paresSet].map((key) => {
      const [varianteId, almacenId] = key.split(":");
      return { varianteId, almacenId };
    });
    const stockPorPar = await lockStockRows(tx, pares);

    const faltantes: string[] = [];
    for (const detalle of proforma.detalles) {
      let restante = detalle.cantidad;
      for (const almacenId of almacenesOrdenados) {
        if (restante <= 0) break;
        const stock = stockPorPar.get(stockKey(detalle.varianteId, almacenId))!;
        const disponibleNeto = stock.cantidadFisica - stock.cantidadReservada;
        const tomar = Math.min(disponibleNeto, restante);
        if (tomar <= 0) continue;

        await tx.stock.update({
          where: { varianteId_almacenId: { varianteId: detalle.varianteId, almacenId } },
          data: { cantidadReservada: { increment: tomar } },
        });
        stock.cantidadReservada += tomar;
        await tx.proformaDetalleAsignacion.create({
          data: { proformaDetalleId: detalle.id, almacenId, cantidad: tomar, origen: OrigenAsignacion.STOCK },
        });
        restante -= tomar;
      }
      if (restante > 0) {
        await tx.proformaDetalleAsignacion.create({
          data: { proformaDetalleId: detalle.id, almacenId: null, cantidad: restante, origen: OrigenAsignacion.PROCURA },
        });
        faltantes.push(`${restante} unidad(es) de la variante ${detalle.varianteId}`);
      }
    }

    await tx.proforma.update({ where: { id }, data: { estado: EstadoProforma.APROBADA } });
    await this.historial.registrar(
      tx,
      id,
      EstadoProforma.APROBADA,
      usuarioId,
      faltantes.length > 0 ? `Cobertura parcial, a procura: ${faltantes.join(", ")}.` : undefined,
    );
  }

  private async liberarReservas(tx: Prisma.TransactionClient, proformaId: string) {
    const asignaciones = await tx.proformaDetalleAsignacion.findMany({
      where: { origen: OrigenAsignacion.STOCK, proformaDetalle: { proformaId } },
      include: { proformaDetalle: true },
    });
    if (asignaciones.length === 0) return;

    const pares = asignaciones.map((a) => ({ varianteId: a.proformaDetalle.varianteId, almacenId: a.almacenId! }));
    await lockStockRows(tx, pares);

    for (const asignacion of asignaciones) {
      await tx.stock.update({
        where: {
          varianteId_almacenId: { varianteId: asignacion.proformaDetalle.varianteId, almacenId: asignacion.almacenId! },
        },
        data: { cantidadReservada: { decrement: asignacion.cantidad } },
      });
    }
  }

  private async transicionCierre(id: string, usuarioId: string, estadoDestino: EstadoProforma, nota?: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;

          const rows = await tx.$queryRaw<{ estado: EstadoProforma; tipo: TipoProforma }[]>`
            SELECT "estado", "tipo" FROM "proformas" WHERE "id" = ${id}::uuid FOR UPDATE
          `;
          const lock = rows[0];
          if (!lock) throw new NotFoundException("Proforma no encontrada.");

          const estadosValidos: EstadoProforma[] = [EstadoProforma.BORRADOR, EstadoProforma.PENDIENTE, EstadoProforma.APROBADA];
          if (!estadosValidos.includes(lock.estado)) {
            throw new ConflictException(`No se puede pasar a ${estadoDestino} desde el estado actual (${lock.estado}).`);
          }

          if (lock.estado === EstadoProforma.APROBADA && lock.tipo === TipoProforma.VENTA) {
            await this.liberarReservas(tx, id);
          }

          await tx.proforma.update({ where: { id }, data: { estado: estadoDestino } });
          await this.historial.registrar(tx, id, estadoDestino, usuarioId, nota);
        },
        { timeout: 15000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }
    return this.proformas.findOne(id);
  }

  async rechazar(id: string, usuarioId: string, nota?: string) {
    return this.transicionCierre(id, usuarioId, EstadoProforma.RECHAZADA, nota);
  }

  async anular(id: string, usuarioId: string, nota?: string) {
    return this.transicionCierre(id, usuarioId, EstadoProforma.ANULADA, nota);
  }
}
