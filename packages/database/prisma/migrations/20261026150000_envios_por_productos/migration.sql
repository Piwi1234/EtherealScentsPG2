-- Envíos por productos: un envío deja de agrupar compras enteras y pasa a agrupar PRODUCTOS RECOGIDOS con su
-- cantidad. Una línea de compra puede ir repartida en varios envíos, y la recepción puede ser parcial (lo que no
-- llegó sigue en camino).

CREATE TABLE "envio_items" (
    "id" UUID NOT NULL,
    "envio_id" UUID NOT NULL,
    "compra_detalle_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "cantidad_recibida" INTEGER NOT NULL DEFAULT 0,
    -- Stock "en tránsito" que este ítem aportó al despachar su envío (se resta exacto al recibir o anular).
    "en_transito_contado" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envio_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "envio_items_cantidad_check" CHECK ("cantidad" > 0 AND "cantidad_recibida" >= 0 AND "cantidad_recibida" <= "cantidad")
);

CREATE UNIQUE INDEX "envio_items_envio_id_compra_detalle_id_key" ON "envio_items"("envio_id", "compra_detalle_id");
CREATE INDEX "envio_items_compra_detalle_id_idx" ON "envio_items"("compra_detalle_id");

CREATE TABLE "envio_recepciones" (
    "id" UUID NOT NULL,
    "envio_id" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" TEXT,
    "creado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envio_recepciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "envio_recepciones_envio_id_idx" ON "envio_recepciones"("envio_id");

CREATE TABLE "envio_recepcion_items" (
    "id" UUID NOT NULL,
    "recepcion_id" UUID NOT NULL,
    "envio_item_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "variante_recibida_id" UUID NOT NULL,
    "nota" TEXT,

    CONSTRAINT "envio_recepcion_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "envio_recepcion_items_cantidad_check" CHECK ("cantidad" > 0)
);

CREATE INDEX "envio_recepcion_items_recepcion_id_idx" ON "envio_recepcion_items"("recepcion_id");
CREATE INDEX "envio_recepcion_items_envio_item_id_idx" ON "envio_recepcion_items"("envio_item_id");

ALTER TABLE "envio_items" ADD CONSTRAINT "envio_items_envio_id_fkey" FOREIGN KEY ("envio_id") REFERENCES "envios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "envio_items" ADD CONSTRAINT "envio_items_compra_detalle_id_fkey" FOREIGN KEY ("compra_detalle_id") REFERENCES "proforma_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "envio_recepciones" ADD CONSTRAINT "envio_recepciones_envio_id_fkey" FOREIGN KEY ("envio_id") REFERENCES "envios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "envio_recepciones" ADD CONSTRAINT "envio_recepciones_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "envio_recepcion_items" ADD CONSTRAINT "envio_recepcion_items_recepcion_id_fkey" FOREIGN KEY ("recepcion_id") REFERENCES "envio_recepciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "envio_recepcion_items" ADD CONSTRAINT "envio_recepcion_items_envio_item_id_fkey" FOREIGN KEY ("envio_item_id") REFERENCES "envio_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "envio_recepcion_items" ADD CONSTRAINT "envio_recepcion_items_variante_recibida_id_fkey" FOREIGN KEY ("variante_recibida_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cuánto de cada línea de solicitud de stock ya llegó (se reparte al recibir, después de las ventas ligadas).
ALTER TABLE "solicitud_stock_lineas" ADD COLUMN "cantidad_recibida" INTEGER NOT NULL DEFAULT 0;

-- ==== Conversión de los envíos existentes (compras enteras) al modelo por productos ====

-- 1) Lo que viajaba en un envío vigente se considera recogido por completo: se crea un recojo por compra
--    (si todavía no tenía) con todas sus líneas.
INSERT INTO "recojos" ("id", "compra_id", "fecha", "nota", "creado_por_id", "created_at")
SELECT gen_random_uuid(), p."id", now(), 'Migración: recogido completo (el envío ya agrupaba la compra entera)', e."creado_por_id", now()
FROM "proformas" p
JOIN "envios" e ON e."id" = p."envio_id"
WHERE e."estado" <> 'ANULADO'
  AND NOT EXISTS (SELECT 1 FROM "recojos" r WHERE r."compra_id" = p."id");

INSERT INTO "recojo_lineas" ("id", "recojo_id", "compra_detalle_id", "cantidad")
SELECT gen_random_uuid(), r."id", d."id", d."cantidad"
FROM "recojos" r
JOIN "proformas" p ON p."id" = r."compra_id"
JOIN "envios" e ON e."id" = p."envio_id"
JOIN "proforma_detalles" d ON d."proforma_id" = p."id"
WHERE e."estado" <> 'ANULADO'
  AND r."nota" LIKE 'Migración: recogido completo%'
  AND NOT EXISTS (SELECT 1 FROM "recojo_lineas" rl WHERE rl."recojo_id" = r."id" AND rl."compra_detalle_id" = d."id");

-- 2) Un ítem por línea de cada compra que estaba en un envío vigente. En envíos ya recibidos lo recibido sale
--    de la recepción registrada; en los que viajan, lo que ya se había contado en tránsito pasa al ítem.
INSERT INTO "envio_items" ("id", "envio_id", "compra_detalle_id", "cantidad", "cantidad_recibida", "en_transito_contado", "created_at")
SELECT
  gen_random_uuid(),
  e."id",
  d."id",
  d."cantidad",
  CASE WHEN e."estado" = 'RECIBIDO'
       THEN LEAST(d."cantidad", COALESCE((SELECT l."cantidad_recibida" FROM "envio_recepcion_lineas" l WHERE l."envio_id" = e."id" AND l."compra_detalle_id" = d."id"), d."cantidad"))
       ELSE 0 END,
  CASE WHEN e."estado" = 'EN_TRANSITO' THEN d."en_transito_contado" ELSE 0 END,
  now()
FROM "proformas" p
JOIN "envios" e ON e."id" = p."envio_id"
JOIN "proforma_detalles" d ON d."proforma_id" = p."id"
WHERE e."estado" <> 'ANULADO';

-- 3) Líneas de solicitud ligadas a compras ya completadas: recibidas por completo.
UPDATE "solicitud_stock_lineas" s
SET "cantidad_recibida" = s."cantidad"
FROM "proforma_detalles" d
JOIN "proformas" p ON p."id" = d."proforma_id"
WHERE s."compra_detalle_id" = d."id" AND p."estado" = 'COMPLETADA';

-- 4) Se retiran las columnas del modelo anterior (el envío ya no cuelga de la compra).
ALTER TABLE "proformas" DROP COLUMN "envio_id";
ALTER TABLE "proforma_detalles" DROP COLUMN "en_transito_contado";
DROP TABLE "envio_recepcion_lineas";
