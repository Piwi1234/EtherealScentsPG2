import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { EstadoCuentaPorCobrar, EstadoProforma, MonedaCartera, NaturalezaMovimiento, OrigenAsignacion, Prisma, TipoProforma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { lockCarteras } from "../contabilidad/cartera-lock.util";
import { AjustarVentaDto } from "./dto/ajustar-venta.dto";
import { CambiarOrigenDto } from "./dto/cambiar-origen.dto";
import { resolverProcuraPendiente } from "./procura.util";
import { ProformaHistorialService } from "./proforma-historial.service";
import { ProformasService } from "./proformas.service";
import { totalPagado } from "./proforma-pagos.service";
import { sumarDescuentos } from "./proforma-totales.util";
import { lockStockRows, stockKey } from "./stock-lock.util";
import { pasarTransitoAStock, recalcularTransitoLinea, reservarTransitoParaProcuras, sumarAsignacion } from "./transito.util";

const redondear = (n: number) => Math.round(n * 100) / 100;

/**
 * Ajuste de una nota de venta APROBADA que no se puede completar tal cual (falta mercadería, etc.): se quitan productos o
 * se bajan cantidades. Libera lo reservado de cada línea (faltante sin compra, faltante ligado a una compra, tránsito y
 * stock, en ese orden), recalcula el total y la cuenta por cobrar y, si lo ya cobrado supera el nuevo total, devuelve el
 * exceso desde la cartera elegida (egreso ligado a la nota). Todo en una transacción.
 */
@Injectable()
export class ProformaAjusteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historial: ProformaHistorialService,
    private readonly proformas: ProformasService,
  ) {}

  /**
   * Cambia el ORIGEN de unidades sueltas de una venta aprobada (solo administrador, ver el controlador). `pasarAPedido` libera
   * lo reservado en el almacén (primero stock físico, luego tránsito) y lo deja como pedido de Seguimiento marcado «a
   * propósito» (`soloPedido`): las reservas automáticas no lo vuelven a tomar. `volverAStock` revierte unidades de pedido a
   * propósito que todavía no están ligadas a una compra y trata de reservarles stock enseguida. No toca el total ni los
   * pagos. Lo liberado queda como stock libre; otras ventas lo toman con «Reservar stock», como al anular.
   */
  async cambiarOrigen(id: string, dto: CambiarOrigenDto, usuarioId: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          const rows = await tx.$queryRaw<{ estado: EstadoProforma; tipo: TipoProforma }[]>`
            SELECT "estado", "tipo" FROM "proformas" WHERE "id" = ${id}::uuid FOR UPDATE
          `;
          const lock = rows[0];
          if (!lock) throw new NotFoundException("Proforma no encontrada.");
          if (lock.tipo !== TipoProforma.VENTA) throw new BadRequestException("Solo se cambia el origen en notas de venta.");
          if (lock.estado !== EstadoProforma.APROBADA) throw new ConflictException(`Solo se cambia el origen en una nota aprobada (está ${lock.estado}).`);

          const proforma = await tx.proforma.findUniqueOrThrow({
            where: { id },
            include: { detalles: { include: { asignaciones: true, variante: { include: { product: { select: { name: true } } } } } } },
          });
          const almacenId = proforma.almacenId;
          if (!almacenId) throw new ConflictException("La nota no tiene almacén.");
          const porId = new Map(proforma.detalles.map((d) => [d.id, d]));

          const cambios = dto.lineas
            .map((l) => ({ ...l, pasar: l.pasarAPedido ?? 0, volver: l.volverAStock ?? 0 }))
            .filter((l) => l.pasar > 0 || l.volver > 0);
          if (cambios.length === 0) throw new BadRequestException("No hay cambios para aplicar.");
          for (const l of cambios) {
            if (!porId.has(l.detalleId)) throw new BadRequestException("Una de las líneas no pertenece a esta nota.");
            if (l.pasar > 0 && l.volver > 0) throw new BadRequestException("En una misma línea no se puede pasar a pedido y volver a stock a la vez.");
          }

          const pares = Array.from(new Set(cambios.map((l) => porId.get(l.detalleId)!.varianteId))).map((varianteId) => ({ varianteId, almacenId }));
          await lockStockRows(tx, pares);

          const resumen: string[] = [];
          const aReservar = new Set<string>();
          for (const l of cambios) {
            const d = porId.get(l.detalleId)!;
            const producto = d.variante.product.name;

            if (l.pasar > 0) {
              // Primero el stock físico (lo que se quiere dejar libre en el almacén), después lo reservado en tránsito.
              const filas = [
                ...d.asignaciones.filter((a) => a.origen === OrigenAsignacion.STOCK && a.cantidad > 0),
                ...d.asignaciones.filter((a) => a.origen === OrigenAsignacion.EN_TRANSITO && a.cantidad > 0),
              ];
              const movible = filas.reduce((n, a) => n + a.cantidad, 0);
              if (l.pasar > movible) throw new BadRequestException(`${producto}: solo hay ${movible} unidad(es) reservadas que se puedan pasar a pedido.`);
              let falta = l.pasar;
              for (const a of filas) {
                if (falta <= 0) break;
                const tomar = Math.min(falta, a.cantidad);
                // No se borra la fila: las que ya tuvieron entregas guardan consumos de lote. Queda en 0 (historial interno).
                await tx.proformaDetalleAsignacion.update({ where: { id: a.id }, data: { cantidad: { decrement: tomar } } });
                await tx.stock.update({
                  where: { varianteId_almacenId: { varianteId: d.varianteId, almacenId } },
                  data: a.origen === OrigenAsignacion.STOCK ? { cantidadReservada: { decrement: tomar } } : { cantidadReservadaTransito: { decrement: tomar } },
                });
                falta -= tomar;
              }
              const existente = await tx.proformaDetalleAsignacion.findFirst({
                where: { proformaDetalleId: d.id, origen: OrigenAsignacion.PROCURA, compraDetalleId: null, soloPedido: true },
              });
              if (existente) await tx.proformaDetalleAsignacion.update({ where: { id: existente.id }, data: { cantidad: { increment: l.pasar } } });
              else await tx.proformaDetalleAsignacion.create({ data: { proformaDetalleId: d.id, almacenId: null, cantidad: l.pasar, origen: OrigenAsignacion.PROCURA, soloPedido: true } });
              resumen.push(`${l.pasar} unidad(es) de ${producto} pasadas a pedido`);
            }

            if (l.volver > 0) {
              const pedidos = d.asignaciones.filter((a) => a.origen === OrigenAsignacion.PROCURA && a.soloPedido && a.cantidad > 0);
              const libres = pedidos.filter((a) => !a.compraDetalleId);
              const disponibles = libres.reduce((n, a) => n + a.cantidad, 0);
              const ligadas = pedidos.filter((a) => a.compraDetalleId).reduce((n, a) => n + a.cantidad, 0);
              if (l.volver > disponibles) {
                throw new ConflictException(
                  ligadas > 0
                    ? `${producto}: solo hay ${disponibles} unidad(es) de pedido sin compra ligada para volver a stock (${ligadas} ya están ligadas a una compra: suéltalas en Seguimiento primero).`
                    : `${producto}: solo hay ${disponibles} unidad(es) de pedido para volver a stock.`,
                );
              }
              let falta = l.volver;
              for (const a of libres) {
                if (falta <= 0) break;
                const tomar = Math.min(falta, a.cantidad);
                await tx.proformaDetalleAsignacion.update({ where: { id: a.id }, data: { cantidad: { decrement: tomar } } });
                falta -= tomar;
              }
              // Vuelve a ser un faltante normal: las reservas automáticas pueden tomarlo.
              await sumarAsignacion(tx, d.id, OrigenAsignacion.PROCURA, null, l.volver);
              aReservar.add(d.varianteId);
              resumen.push(`${l.volver} unidad(es) de ${producto} vueltas a stock`);
            }
          }

          // Lo que volvió a stock intenta reservar enseguida el stock libre (solo para esta nota y estos productos).
          for (const varianteId of aReservar) {
            const stock = await tx.stock.findUniqueOrThrow({ where: { varianteId_almacenId: { varianteId, almacenId } } });
            await resolverProcuraPendiente(tx, { varianteId, almacenId, disponible: stock.cantidadFisica - stock.cantidadReservada, soloLibres: true, soloProformaId: id });
            await pasarTransitoAStock(tx, { varianteId, almacenId, soloProformaId: id });
            await reservarTransitoParaProcuras(tx, { varianteId, almacenId, soloProformaId: id });
          }

          await this.historial.registrar(tx, id, EstadoProforma.APROBADA, usuarioId, `Origen cambiado: ${resumen.join("; ")}.${dto.motivo?.trim() ? ` Motivo: ${dto.motivo.trim()}.` : ""}`);
        },
        { timeout: 30000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }
    return this.proformas.findOne(id);
  }

  async ajustar(id: string, dto: AjustarVentaDto, usuarioId: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          const rows = await tx.$queryRaw<{ estado: EstadoProforma; tipo: TipoProforma }[]>`
            SELECT "estado", "tipo" FROM "proformas" WHERE "id" = ${id}::uuid FOR UPDATE
          `;
          const lock = rows[0];
          if (!lock) throw new NotFoundException("Proforma no encontrada.");
          if (lock.tipo !== TipoProforma.VENTA) throw new BadRequestException("Solo se ajustan notas de venta.");
          if (lock.estado !== EstadoProforma.APROBADA) {
            throw new ConflictException(`Solo se ajusta una nota aprobada (está ${lock.estado}).`);
          }

          const proforma = await tx.proforma.findUniqueOrThrow({
            where: { id },
            include: {
              cliente: true,
              detalles: { include: { asignaciones: true, entregas: { select: { cantidad: true } }, variante: { include: { product: { select: { name: true } } } } } },
            },
          });

          // --- Validar los cambios pedidos ---
          const porId = new Map(proforma.detalles.map((d) => [d.id, d]));
          const cambios = new Map<string, number>(); // detalleId → cantidad nueva
          for (const l of dto.lineas) {
            const d = porId.get(l.detalleId);
            if (!d) throw new BadRequestException("Una de las líneas no pertenece a esta nota.");
            if (l.cantidad < 0 || l.cantidad >= d.cantidad) {
              throw new BadRequestException(`${d.variante.product.name}: la cantidad nueva tiene que ser menor a ${d.cantidad} (0 quita el producto).`);
            }
            const entregadas = d.entregas.reduce((n, e) => n + e.cantidad, 0);
            if (l.cantidad < entregadas) {
              throw new BadRequestException(`${d.variante.product.name}: ya se entregaron ${entregadas}, no se puede bajar a ${l.cantidad}. Deshacé la entrega primero.`);
            }
            cambios.set(l.detalleId, l.cantidad);
          }
          if (cambios.size === 0) throw new BadRequestException("No hay cambios para aplicar.");
          const quedan = proforma.detalles.filter((d) => (cambios.get(d.id) ?? d.cantidad) > 0);
          if (quedan.length === 0) throw new ConflictException("Con esos cambios la nota queda sin productos: anulala en vez de ajustarla.");

          // --- Nuevo total y cuánto hay que devolver ---
          // El descuento es por unidad: cada línea que baja devuelve su precio menos su descuento.
          const subtotalNuevo = quedan.reduce((n, d) => n + (cambios.get(d.id) ?? d.cantidad) * Number(d.precioUnitario ?? 0), 0);
          const descuentoNuevo = sumarDescuentos(quedan.map((d) => ({ cantidad: cambios.get(d.id) ?? d.cantidad, descuentoUnitario: d.descuentoUnitario })));
          const total = redondear(subtotalNuevo - descuentoNuevo);
          const pagado = await totalPagado(tx, id);
          const exceso = Math.max(0, redondear(pagado - total));

          if (exceso > 0) {
            if (!dto.carteraId) {
              throw new BadRequestException(`Lo cobrado (Bs ${pagado.toFixed(2)}) supera el nuevo total (Bs ${total.toFixed(2)}): elegí la cartera desde la que se devuelve Bs ${exceso.toFixed(2)}.`);
            }
            const cartera = await tx.cartera.findUnique({ where: { id: dto.carteraId } });
            if (!cartera || !cartera.activo) throw new BadRequestException("carteraId inválido o inactivo.");
            if (cartera.moneda !== MonedaCartera.BS) throw new BadRequestException("La cartera de la devolución debe ser en Bs.");
          }

          // --- Liberar lo reservado de cada línea que baja ---
          const pares = proforma.detalles
            .filter((d) => cambios.has(d.id) && proforma.almacenId)
            .map((d) => ({ varianteId: d.varianteId, almacenId: proforma.almacenId! }));
          await lockStockRows(tx, pares);
          const comprasAfectadas = new Set<string>();
          const resumenCambios: string[] = [];

          for (const d of proforma.detalles) {
            if (!cambios.has(d.id)) continue;
            const nueva = cambios.get(d.id)!;
            let liberar = d.cantidad - nueva;
            const almacenId = proforma.almacenId;

            // Orden: faltante sin compra → faltante ligado a una compra → reservado en tránsito → stock reservado.
            const prioridad = (a: { origen: OrigenAsignacion; compraDetalleId: string | null }) =>
              a.origen === OrigenAsignacion.PROCURA ? (a.compraDetalleId ? 1 : 0) : a.origen === OrigenAsignacion.EN_TRANSITO ? 2 : 3;
            const filas = d.asignaciones.filter((a) => a.cantidad > 0).sort((x, y) => prioridad(x) - prioridad(y) || y.createdAt.getTime() - x.createdAt.getTime());
            for (const a of filas) {
              if (liberar <= 0) break;
              const tomar = Math.min(liberar, a.cantidad);
              if (tomar === a.cantidad) await tx.proformaDetalleAsignacion.delete({ where: { id: a.id } });
              else await tx.proformaDetalleAsignacion.update({ where: { id: a.id }, data: { cantidad: { decrement: tomar } } });
              if (a.origen === OrigenAsignacion.PROCURA && a.compraDetalleId) comprasAfectadas.add(a.compraDetalleId);
              if (almacenId && a.origen === OrigenAsignacion.STOCK) {
                await tx.stock.update({ where: { varianteId_almacenId: { varianteId: d.varianteId, almacenId } }, data: { cantidadReservada: { decrement: tomar } } });
              }
              if (almacenId && a.origen === OrigenAsignacion.EN_TRANSITO) {
                await tx.stock.update({ where: { varianteId_almacenId: { varianteId: d.varianteId, almacenId } }, data: { cantidadReservadaTransito: { decrement: tomar } } });
              }
              liberar -= tomar;
            }

            if (nueva === 0) {
              await tx.proformaDetalleAsignacion.deleteMany({ where: { proformaDetalleId: d.id } });
              await tx.proformaDetalle.delete({ where: { id: d.id } });
              resumenCambios.push(`${d.variante.product.name}: quitado (eran ${d.cantidad})`);
            } else {
              await tx.proformaDetalle.update({ where: { id: d.id }, data: { cantidad: nueva, subtotal: nueva * Number(d.precioUnitario ?? 0) } });
              resumenCambios.push(`${d.variante.product.name}: ${d.cantidad} → ${nueva}`);
            }
          }

          // --- Devolución, cuenta por cobrar y cabecera ---
          if (exceso > 0) {
            await lockCarteras(tx, [dto.carteraId!]);
            await tx.movimientoCartera.create({
              data: {
                carteraId: dto.carteraId!,
                fecha: new Date(),
                detalle: `CL: ${proforma.cliente?.nombre ?? "—"} - PR: ${proforma.codigo} - DEVOLUCIÓN POR AJUSTE DE LA NOTA`,
                naturaleza: NaturalezaMovimiento.GASTO,
                monto: exceso,
                proformaId: id,
                creadoPorId: usuarioId,
              },
            });
            await tx.cartera.update({ where: { id: dto.carteraId! }, data: { saldoActual: { decrement: exceso } } });
          }
          const adeudado = Math.max(0, redondear(total - (pagado - exceso)));
          await tx.cuentaPorCobrar.updateMany({
            where: { proformaId: id },
            data: { montoTotal: total, montoAdeudado: adeudado, estado: adeudado <= 0 ? EstadoCuentaPorCobrar.COMPLETADO : EstadoCuentaPorCobrar.PENDIENTE },
          });
          await tx.proforma.update({ where: { id }, data: { descuentoGeneral: descuentoNuevo } });

          // Lo que estaba ligado a una compra deja de cubrir esas unidades: el tránsito libre se recalcula.
          for (const compraDetalleId of comprasAfectadas) await recalcularTransitoLinea(tx, compraDetalleId);

          const nota = [
            `Nota ajustada: ${resumenCambios.join("; ")}.`,
            `Nuevo total Bs ${total.toFixed(2)}.`,
            exceso > 0 ? `Devueltos Bs ${exceso.toFixed(2)} desde la cartera elegida.` : "",
            dto.motivo?.trim() ? `Motivo: ${dto.motivo.trim()}.` : "",
          ]
            .filter(Boolean)
            .join(" ");
          await this.historial.registrar(tx, id, EstadoProforma.APROBADA, usuarioId, nota);
        },
        { timeout: 30000, maxWait: 5000 },
      );
    } catch (error) {
      rethrowPrismaError(error, "Proforma");
    }
    return this.proformas.findOne(id);
  }
}
