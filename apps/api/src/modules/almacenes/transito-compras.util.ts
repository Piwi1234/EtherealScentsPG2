import { EstadoEnvio, EstadoProforma, Prisma, TipoProforma } from "@app/database";
import { PrismaService } from "../../common/prisma.service";

/**
 * Lo que viaja por compra aprobada, por variante y almacén destino: recogido − recibido de cada línea (`total`), y de
 * eso, lo que ya está ligado a notas de venta (`ligado`, nunca más que lo que viaja). Es lo mismo que
 * recalcularTransitoLinea descuenta de Stock.cantidadEnTransito, pero acá se cuenta completo (Stock.cantidadEnTransito
 * solo lleva lo libre). Disponible en tránsito = total − ligado − Stock.cantidadReservadaTransito.
 */
export async function transitoCompras(
  prisma: PrismaService,
  opts: { almacenId?: string; varianteId?: string; varianteIds?: string[]; varianteWhere?: Prisma.ProductVariantWhereInput },
): Promise<{ varianteId: string; almacenId: string; total: number; ligado: number }[]> {
  const lineas = await prisma.proformaDetalle.findMany({
    where: {
      varianteId: opts.varianteId ?? (opts.varianteIds ? { in: opts.varianteIds } : undefined),
      variante: opts.varianteWhere,
      proforma: { tipo: TipoProforma.COMPRA, estado: EstadoProforma.APROBADA, almacenId: opts.almacenId ?? { not: null } },
    },
    select: {
      varianteId: true,
      proforma: { select: { almacenId: true } },
      recojoLineas: { select: { cantidad: true } },
      envioItems: { where: { envio: { estado: { not: EstadoEnvio.ANULADO } } }, select: { cantidadRecibida: true } },
      asignacionesCubiertas: { select: { cantidad: true } },
    },
  });
  const porPar = new Map<string, { varianteId: string; almacenId: string; total: number; ligado: number }>();
  for (const l of lineas) {
    const almacenId = l.proforma.almacenId;
    if (!almacenId) continue;
    const total = Math.max(0, l.recojoLineas.reduce((n, r) => n + r.cantidad, 0) - l.envioItems.reduce((n, i) => n + i.cantidadRecibida, 0));
    if (total === 0) continue;
    const ligado = Math.min(total, l.asignacionesCubiertas.reduce((n, a) => n + a.cantidad, 0));
    const key = `${l.varianteId}|${almacenId}`;
    const acc = porPar.get(key) ?? { varianteId: l.varianteId, almacenId, total: 0, ligado: 0 };
    acc.total += total;
    acc.ligado += ligado;
    porPar.set(key, acc);
  }
  return Array.from(porPar.values());
}
