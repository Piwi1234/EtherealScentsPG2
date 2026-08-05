import { Prisma } from "@app/database";

type StockLockRow = {
  variante_id: string;
  almacen_id: string;
  cantidad_fisica: number;
  cantidad_reservada: number;
};

export function stockKey(varianteId: string, almacenId: string): string {
  return `${varianteId}:${almacenId}`;
}

/**
 * Crea (si no existe) y bloquea, en un único paso atómico por par, cada fila de Stock involucrada —
 * siempre en el mismo orden global (variante, almacén) para no generar deadlocks entre transacciones
 * concurrentes. INSERT ... ON CONFLICT ... RETURNING evita la carrera de "dos transacciones ven la
 * fila inexistente y ambas intentan insertarla" que un SELECT FOR UPDATE simple no cerraría.
 *
 * Invariante a respetar en todo el módulo: ningún código puede leer o consumir LoteCompra de un par
 * (variante, almacén) sin haber pasado antes por acá para ese mismo par, en la misma transacción.
 * Compartido entre proforma-approval.service.ts y proforma-completion.service.ts para no duplicar
 * lógica de locking (es la parte más sensible a bugs de todo el módulo).
 */
export async function lockStockRows(
  tx: Prisma.TransactionClient,
  pares: { varianteId: string; almacenId: string }[],
): Promise<Map<string, { cantidadFisica: number; cantidadReservada: number }>> {
  const ordenados = [...pares].sort((a, b) =>
    a.varianteId === b.varianteId ? a.almacenId.localeCompare(b.almacenId) : a.varianteId.localeCompare(b.varianteId),
  );

  const resultado = new Map<string, { cantidadFisica: number; cantidadReservada: number }>();
  for (const { varianteId, almacenId } of ordenados) {
    const rows = await tx.$queryRaw<StockLockRow[]>`
      INSERT INTO "stock" ("variante_id", "almacen_id", "cantidad_fisica", "cantidad_reservada", "updated_at")
      VALUES (${varianteId}::uuid, ${almacenId}::uuid, 0, 0, now())
      ON CONFLICT ("variante_id", "almacen_id") DO UPDATE SET "updated_at" = now()
      RETURNING "variante_id", "almacen_id", "cantidad_fisica", "cantidad_reservada"
    `;
    const row = rows[0];
    resultado.set(stockKey(varianteId, almacenId), {
      cantidadFisica: row.cantidad_fisica,
      cantidadReservada: row.cantidad_reservada,
    });
  }
  return resultado;
}
