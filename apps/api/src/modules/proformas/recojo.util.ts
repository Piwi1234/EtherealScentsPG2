import { Prisma } from "@app/database";

/** Lo que hace falta leer de una línea de compra para repartir lo recogido entre lo que la cubre. */
export const compraConEnlacesSelect = {
  recojoLineas: { select: { cantidad: true } },
  asignacionesCubiertas: { select: { id: true, cantidad: true, createdAt: true } },
  solicitudesCubiertas: { select: { id: true, cantidad: true, createdAt: true } },
} satisfies Prisma.ProformaDetalleSelect;

export type CompraConEnlaces = {
  recojoLineas: { cantidad: number }[];
  asignacionesCubiertas: { id: string; cantidad: number; createdAt: Date }[];
  solicitudesCubiertas: { id: string; cantidad: number; createdAt: Date }[];
};

export function totalRecogido(compra: Pick<CompraConEnlaces, "recojoLineas">): number {
  return compra.recojoLineas.reduce((n, r) => n + r.cantidad, 0);
}

/**
 * Cuántas de las unidades recogidas de una línea de compra le tocan a cada vínculo (faltante de venta o línea
 * de solicitud). Regla: lo recogido sirve primero a las ventas (de la más antigua a la más nueva) y después a
 * las solicitudes; lo que sobra es stock libre. Así "Recogido" en una venta significa que ya hay unidades
 * físicas recogidas para ella.
 */
export function recogidasPorEnlace(compra: CompraConEnlaces): Map<string, number> {
  let pool = totalRecogido(compra);
  const orden = [
    ...[...compra.asignacionesCubiertas].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    ...[...compra.solicitudesCubiertas].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  ];
  const resultado = new Map<string, number>();
  for (const enlace of orden) {
    const toca = Math.min(pool, enlace.cantidad);
    resultado.set(enlace.id, toca);
    pool -= toca;
  }
  return resultado;
}

export function recogidasDeEnlace(compra: CompraConEnlaces, enlaceId: string): number {
  return recogidasPorEnlace(compra).get(enlaceId) ?? 0;
}
