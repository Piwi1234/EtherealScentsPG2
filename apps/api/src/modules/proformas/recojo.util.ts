import { EstadoEnvio, EstadoProforma, Prisma } from "@app/database";

export type EstadoPedidoDerivado = "SIN_COMPRA" | "EN_PREPARACION" | "COMPRADO" | "RECOGIDO" | "EN_TRANSITO";

/**
 * Estado de lo que cubre una compra (un faltante de venta o una línea de solicitud) según su compra: sin compra,
 * en preparación (borrador), comprado, recogido (todas sus unidades ya recogidas) o enviado (ya salieron en un
 * envío). Si la compra ya se cerró (completada o anulada) y el faltante sigue pendiente, vuelve a "sin compra".
 */
export function estadoSegunCompra(compraEstado: EstadoProforma | undefined, cantidad: number, recogidas: number, enviadas: number): EstadoPedidoDerivado {
  if (!compraEstado) return "SIN_COMPRA";
  if (compraEstado === EstadoProforma.BORRADOR) return "EN_PREPARACION";
  if (compraEstado !== EstadoProforma.APROBADA) return "SIN_COMPRA";
  if (enviadas >= cantidad) return "EN_TRANSITO";
  return recogidas >= cantidad ? "RECOGIDO" : "COMPRADO";
}

/** Lo que hace falta leer de una línea de compra para repartir lo recogido/enviado entre lo que la cubre. */
export const compraConEnlacesSelect = {
  recojoLineas: { select: { cantidad: true } },
  // Solo cuentan los envíos que ya salieron: armar un envío todavía no es "Enviado".
  envioItems: {
    where: { envio: { estado: { in: [EstadoEnvio.EN_TRANSITO, EstadoEnvio.RECIBIDO] } } },
    select: { cantidad: true, envio: { select: { id: true, codigo: true, estado: true } } },
  },
  asignacionesCubiertas: { select: { id: true, cantidad: true, createdAt: true } },
  solicitudesCubiertas: { select: { id: true, cantidad: true, createdAt: true } },
} satisfies Prisma.ProformaDetalleSelect;

export type CompraConEnlaces = {
  recojoLineas: { cantidad: number }[];
  envioItems: { cantidad: number }[];
  asignacionesCubiertas: { id: string; cantidad: number; createdAt: Date }[];
  solicitudesCubiertas: { id: string; cantidad: number; createdAt: Date }[];
};

export function totalRecogido(compra: Pick<CompraConEnlaces, "recojoLineas">): number {
  return compra.recojoLineas.reduce((n, r) => n + r.cantidad, 0);
}

export function totalEnviado(compra: Pick<CompraConEnlaces, "envioItems">): number {
  return compra.envioItems.reduce((n, r) => n + r.cantidad, 0);
}

/**
 * Reparte un pozo de unidades (recogidas o enviadas) entre los vínculos de una línea de compra. Regla: sirve
 * primero a las ventas (de la más antigua a la más nueva) y después a las solicitudes; lo que sobra es stock
 * libre. Así "Recogido"/"Enviado" en una venta significa que ya hay unidades físicas para ella.
 */
function repartirPozo(compra: CompraConEnlaces, pozo: number): Map<string, number> {
  const orden = [
    ...[...compra.asignacionesCubiertas].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    ...[...compra.solicitudesCubiertas].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  ];
  const resultado = new Map<string, number>();
  for (const enlace of orden) {
    const toca = Math.min(pozo, enlace.cantidad);
    resultado.set(enlace.id, toca);
    pozo -= toca;
  }
  return resultado;
}

export function recogidasPorEnlace(compra: CompraConEnlaces): Map<string, number> {
  return repartirPozo(compra, totalRecogido(compra));
}

export function enviadasPorEnlace(compra: CompraConEnlaces): Map<string, number> {
  return repartirPozo(compra, totalEnviado(compra));
}

export function recogidasDeEnlace(compra: CompraConEnlaces, enlaceId: string): number {
  return recogidasPorEnlace(compra).get(enlaceId) ?? 0;
}

export function enviadasDeEnlace(compra: CompraConEnlaces, enlaceId: string): number {
  return enviadasPorEnlace(compra).get(enlaceId) ?? 0;
}
