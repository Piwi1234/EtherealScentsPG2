import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoProforma, OrigenAsignacion, TipoProforma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { EntregarVentaDto } from "./dto/entregar-venta.dto";
import { ProformaCompletionService } from "./proforma-completion.service";
import { ProformaHistorialService } from "./proforma-historial.service";
import { ProformasService } from "./proformas.service";
import { lockStockRows } from "./stock-lock.util";

/**
 * Entregas parciales de una nota de venta APROBADA: marcar un producto como entregado saca del almacén lo que estaba
 * reservado en stock físico (lo que está en tránsito o falta no se toca). Consume los lotes elegidos (costo real para el
 * margen), baja Stock.cantidadFisica y cantidadReservada y la asignación STOCK de la línea. Cuando todas las líneas quedan
 * entregadas, la nota se completa sola. Se puede deshacer mientras siga aprobada.
 */
@Injectable()
export class ProformaEntregaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historial: ProformaHistorialService,
    private readonly completion: ProformaCompletionService,
    private readonly proformas: ProformasService,
  ) {}

  async entregar(id: string, dto: EntregarVentaDto, usuarioId: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          const rows = await tx.$queryRaw<{ estado: EstadoProforma; tipo: TipoProforma; almacenId: string | null }[]>`
            SELECT "estado", "tipo", "almacen_id" AS "almacenId" FROM "proformas" WHERE "id" = ${id}::uuid FOR UPDATE
          `;
          const lock = rows[0];
          if (!lock) throw new NotFoundException("Proforma no encontrada.");
          if (lock.tipo !== TipoProforma.VENTA) throw new BadRequestException("Solo las notas de venta tienen entregas.");
          if (lock.estado !== EstadoProforma.APROBADA) throw new ConflictException(`Solo se entrega una nota aprobada (está ${lock.estado}).`);
          if (!lock.almacenId) throw new ConflictException("La nota no tiene almacén asignado.");
          const almacenId = lock.almacenId;

          const detalles = await tx.proformaDetalle.findMany({
            where: { proformaId: id },
            include: {
              variante: { include: { product: { select: { name: true } } } },
              asignaciones: { where: { origen: OrigenAsignacion.STOCK, cantidad: { gt: 0 } }, orderBy: { createdAt: "asc" } },
            },
          });
          const porId = new Map(detalles.map((d) => [d.id, d]));

          // Una misma línea puede venir repetida: se junta antes de validar.
          const lotesPorLinea = new Map<string, Map<string, number>>();
          for (const l of dto.lineas) {
            if (!porId.has(l.proformaDetalleId)) throw new BadRequestException("Una de las líneas no pertenece a esta nota.");
            const lotes = lotesPorLinea.get(l.proformaDetalleId) ?? new Map<string, number>();
            for (const e of l.lotes) lotes.set(e.loteCompraId, (lotes.get(e.loteCompraId) ?? 0) + e.cantidad);
            lotesPorLinea.set(l.proformaDetalleId, lotes);
          }

          await lockStockRows(tx, Array.from(lotesPorLinea.keys()).map((detalleId) => ({ varianteId: porId.get(detalleId)!.varianteId, almacenId })));

          const resumen: string[] = [];
          for (const [detalleId, lotes] of lotesPorLinea) {
            const d = porId.get(detalleId)!;
            const nombre = d.variante.product.name;
            const cantidad = Array.from(lotes.values()).reduce((n, c) => n + c, 0);
            const reservado = d.asignaciones.reduce((n, a) => n + a.cantidad, 0);
            if (cantidad > reservado) {
              throw new ConflictException(
                `${nombre}: solo hay ${reservado} unidad(es) reservada(s) en stock para entregar y quisiste entregar ${cantidad}. Lo que está en tránsito o falta no se entrega.`,
              );
            }

            const entrega = await tx.entregaVenta.create({ data: { proformaDetalleId: detalleId, cantidad, nota: dto.nota?.trim() || undefined, creadoPorId: usuarioId } });

            // Qué lote cubre qué asignación STOCK (la más antigua primero).
            const pendientes = d.asignaciones.map((a) => ({ id: a.id, resta: a.cantidad }));
            const consumos = new Map<string, number>(); // `${lote}|${asignación}` → cantidad
            for (const [loteCompraId, cantLote] of lotes) {
              const lote = await tx.loteCompra.findUnique({ where: { id: loteCompraId } });
              if (!lote || lote.varianteId !== d.varianteId || lote.almacenId !== almacenId) {
                throw new BadRequestException(`${nombre}: un lote no corresponde a este producto en el almacén de la nota.`);
              }
              const res = await tx.loteCompra.updateMany({
                where: { id: loteCompraId, cantidadDisponible: { gte: cantLote } },
                data: { cantidadDisponible: { decrement: cantLote } },
              });
              if (res.count === 0) throw new ConflictException(`${nombre}: el lote ya no tiene ${cantLote} unidad(es) disponibles.`);
              let falta = cantLote;
              for (const p of pendientes) {
                if (falta <= 0) break;
                const tomar = Math.min(falta, p.resta);
                if (tomar <= 0) continue;
                p.resta -= tomar;
                falta -= tomar;
                const key = `${loteCompraId}|${p.id}`;
                consumos.set(key, (consumos.get(key) ?? 0) + tomar);
              }
            }
            for (const [key, cant] of consumos) {
              const [loteCompraId, asignacionId] = key.split("|");
              await tx.loteCompraConsumo.create({ data: { loteCompraId, proformaDetalleAsignacionId: asignacionId, entregaId: entrega.id, cantidad: cant } });
            }
            for (const a of d.asignaciones) {
              const entregadas = a.cantidad - (pendientes.find((p) => p.id === a.id)?.resta ?? a.cantidad);
              if (entregadas > 0) await tx.proformaDetalleAsignacion.update({ where: { id: a.id }, data: { cantidad: { decrement: entregadas } } });
            }
            await tx.stock.update({
              where: { varianteId_almacenId: { varianteId: d.varianteId, almacenId } },
              data: { cantidadFisica: { decrement: cantidad }, cantidadReservada: { decrement: cantidad } },
            });
            resumen.push(`${nombre} x${cantidad}`);
          }

          const nota = `Entregado: ${resumen.join(", ")}.${dto.nota?.trim() ? ` ${dto.nota.trim()}` : ""}`;
          await this.historial.registrar(tx, id, EstadoProforma.APROBADA, usuarioId, nota);

          // Con todo entregado, la nota se completa sola.
          const todas = await tx.proformaDetalle.findMany({ where: { proformaId: id }, select: { cantidad: true, entregas: { select: { cantidad: true } } } });
          if (todas.every((d) => d.entregas.reduce((n, e) => n + e.cantidad, 0) >= d.cantidad)) {
            await this.completion.finalizarVenta(tx, id, usuarioId, true, "Completada automáticamente: se entregaron todos los productos.");
          }
        },
        { timeout: 30000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Entrega");
    }
    return this.proformas.findOne(id);
  }

  /** Deshace una entrega: devuelve las unidades al lote, al stock físico y a lo reservado. Solo con la nota aprobada. */
  async deshacer(id: string, entregaId: string, usuarioId: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          const rows = await tx.$queryRaw<{ estado: EstadoProforma; almacenId: string | null }[]>`
            SELECT "estado", "almacen_id" AS "almacenId" FROM "proformas" WHERE "id" = ${id}::uuid FOR UPDATE
          `;
          const lock = rows[0];
          if (!lock) throw new NotFoundException("Proforma no encontrada.");
          if (lock.estado !== EstadoProforma.APROBADA) {
            throw new ConflictException(`Solo se deshace una entrega de una nota aprobada (está ${lock.estado}).`);
          }
          const entrega = await tx.entregaVenta.findUnique({
            where: { id: entregaId },
            include: { consumos: true, proformaDetalle: { include: { variante: { include: { product: { select: { name: true } } } } } } },
          });
          if (!entrega || entrega.proformaDetalle.proformaId !== id) throw new NotFoundException("Entrega no encontrada.");
          const almacenId = lock.almacenId;
          if (!almacenId) throw new ConflictException("La nota no tiene almacén asignado.");
          const d = entrega.proformaDetalle;

          await lockStockRows(tx, [{ varianteId: d.varianteId, almacenId }]);
          for (const c of entrega.consumos) {
            await tx.loteCompra.update({ where: { id: c.loteCompraId }, data: { cantidadDisponible: { increment: c.cantidad } } });
            await tx.proformaDetalleAsignacion.update({ where: { id: c.proformaDetalleAsignacionId }, data: { cantidad: { increment: c.cantidad } } });
          }
          await tx.loteCompraConsumo.deleteMany({ where: { entregaId } });
          await tx.entregaVenta.delete({ where: { id: entregaId } });
          await tx.stock.update({
            where: { varianteId_almacenId: { varianteId: d.varianteId, almacenId } },
            data: { cantidadFisica: { increment: entrega.cantidad }, cantidadReservada: { increment: entrega.cantidad } },
          });
          await this.historial.registrar(tx, id, EstadoProforma.APROBADA, usuarioId, `Entrega deshecha: ${d.variante.product.name} x${entrega.cantidad}.`);
        },
        { timeout: 30000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Entrega");
    }
    return this.proformas.findOne(id);
  }
}
