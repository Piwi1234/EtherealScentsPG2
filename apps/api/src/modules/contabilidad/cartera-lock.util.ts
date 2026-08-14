import { Prisma } from "@app/database";

/**
 * Lockea 1 o 2 filas de Cartera por id (SELECT ... FOR UPDATE), siempre ordenadas por id, para que
 * transacciones concurrentes que tocan las mismas 2 carteras (ej. dos traspasos cruzados) no generen
 * deadlock. Más simple que stock-lock.util.ts: una Cartera siempre existe de antemano (se crea por
 * su propio endpoint, no al vuelo), así que alcanza con el SELECT — no hace falta el patrón INSERT
 * ... ON CONFLICT.
 */
export async function lockCarteras(tx: Prisma.TransactionClient, ids: string[]): Promise<void> {
  const ordenados = [...new Set(ids)].sort();
  for (const id of ordenados) {
    await tx.$queryRaw`SELECT "id" FROM "carteras" WHERE "id" = ${id}::uuid FOR UPDATE`;
  }
}
