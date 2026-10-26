-- Lo recogido que no está ligado a una venta ni a una solicitud cuenta como stock en tránsito desde el recojo
-- (antes, desde que el envío salía). El aporte se guarda por línea de compra y en qué almacén se contó.
ALTER TABLE "proforma_detalles" ADD COLUMN "en_transito_contado" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "proforma_detalles" ADD COLUMN "en_transito_almacen_id" UUID;
ALTER TABLE "proforma_detalles"
  ADD CONSTRAINT "proforma_detalles_en_transito_almacen_id_fkey" FOREIGN KEY ("en_transito_almacen_id") REFERENCES "almacenes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lo que ya estaba contado por ítems de envíos en camino pasa a la línea de compra.
UPDATE "proforma_detalles" d
SET "en_transito_contado" = x.total, "en_transito_almacen_id" = x.almacen_id
FROM (
  SELECT i."compra_detalle_id" AS detalle_id, SUM(i."en_transito_contado") AS total, MIN(e."almacen_destino_id"::text)::uuid AS almacen_id
  FROM "envio_items" i JOIN "envios" e ON e."id" = i."envio_id"
  WHERE e."estado" = 'EN_TRANSITO' AND i."en_transito_contado" > 0
  GROUP BY i."compra_detalle_id"
) x
WHERE d."id" = x.detalle_id;

ALTER TABLE "envio_items" DROP COLUMN "en_transito_contado";

-- Toda compra sin completar tiene un almacén destino: el predeterminado (o el primero activo).
UPDATE "proformas"
SET "almacen_id" = COALESCE(
  (SELECT "id" FROM "almacenes" WHERE "predeterminado" = true LIMIT 1),
  (SELECT "id" FROM "almacenes" WHERE "activo" = true ORDER BY "created_at" LIMIT 1))
WHERE "tipo" = 'COMPRA' AND "estado" IN ('BORRADOR', 'APROBADA') AND "almacen_id" IS NULL;
