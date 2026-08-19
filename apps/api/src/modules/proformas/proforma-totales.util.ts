import { Prisma } from "@app/database";

/** Mismo cálculo que ProformaTotales.tsx (frontend) — nada se persiste server-side salvo el
 * adelanto (al aprobar) y el saldo pendiente (al completar, ver CuentaPorCobrar), así que se
 * replica acá. Redondeado a 2 decimales (Decimal(14,2) de MovimientoCartera.monto /
 * CuentaPorCobrar.montoAdeudado). Solo aplica a VENTA — para COMPRA no hay adelanto ni saldo. */
export function calcularTotalesVenta(proforma: {
  detalles: { subtotal: Prisma.Decimal }[];
  descuentoGeneral: Prisma.Decimal;
  adelantoPorcentaje: Prisma.Decimal | null;
}): { subtotal: number; total: number; montoAdelanto: number; saldo: number } {
  const subtotal = proforma.detalles.reduce((sum, d) => sum + Number(d.subtotal), 0);
  const total = subtotal - Number(proforma.descuentoGeneral);
  const porcentaje = Number(proforma.adelantoPorcentaje ?? 0);
  const montoAdelanto = Math.round(total * (porcentaje / 100) * 100) / 100;
  const saldo = Math.round((total - montoAdelanto) * 100) / 100;
  return { subtotal, total, montoAdelanto, saldo };
}
