-- Decants: conversión de frascos a ml, baja de ml, costo de empaque por presentación y categorías que permiten decants.

-- Los lotes de ml heredan el costo del frasco dividido entre sus ml: hacen falta 4 decimales (ampliar es sin pérdida).
ALTER TABLE "lotes_compra" ALTER COLUMN "costo_unitario" TYPE DECIMAL(12,4);

ALTER TABLE "categories" ADD COLUMN "permite_decants" BOOLEAN NOT NULL DEFAULT false;

-- Las categorías que ya tienen variantes en ml (o presentaciones) siguen funcionando: quedan habilitadas.
UPDATE "categories" SET "permite_decants" = true
WHERE "id" IN (
  SELECT DISTINCT p."category_id"
  FROM "product_variants" v
  JOIN "products" p ON p."id" = v."product_id"
  WHERE v."unidad" = 'ML'
);

ALTER TABLE "presentaciones_venta" ADD COLUMN "costo_empaque_bs" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "proforma_detalles" ADD COLUMN "costo_empaque_bs" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Las líneas ya vendidas por presentación toman el costo vigente (hoy 0, igual que antes: no cambia ningún margen).
CREATE TYPE "tipo_movimiento_decant" AS ENUM ('CONVERSION', 'BAJA');

CREATE TABLE "movimientos_decant" (
  "id" UUID NOT NULL,
  "tipo" "tipo_movimiento_decant" NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "variante_id" UUID NOT NULL,
  "variante_origen_id" UUID,
  "almacen_id" UUID NOT NULL,
  "cantidad_frascos" INTEGER NOT NULL DEFAULT 0,
  "ml_por_frasco" INTEGER NOT NULL DEFAULT 0,
  "cantidad_ml" INTEGER NOT NULL,
  "costo_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "nota" TEXT,
  "creado_por_id" UUID NOT NULL,
  "revertido_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "movimientos_decant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "movimientos_decant_cantidad_ml_check" CHECK ("cantidad_ml" > 0)
);

CREATE INDEX "movimientos_decant_variante_id_almacen_id_idx" ON "movimientos_decant"("variante_id", "almacen_id");

ALTER TABLE "movimientos_decant" ADD CONSTRAINT "movimientos_decant_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_decant" ADD CONSTRAINT "movimientos_decant_variante_origen_id_fkey" FOREIGN KEY ("variante_origen_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_decant" ADD CONSTRAINT "movimientos_decant_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_decant" ADD CONSTRAINT "movimientos_decant_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "movimientos_decant_lote" (
  "id" UUID NOT NULL,
  "movimiento_id" UUID NOT NULL,
  "lote_origen_id" UUID NOT NULL,
  "lote_destino_id" UUID,
  "cantidad" INTEGER NOT NULL,
  "costo_unitario" DECIMAL(12,4) NOT NULL,
  CONSTRAINT "movimientos_decant_lote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "movimientos_decant_lote" ADD CONSTRAINT "movimientos_decant_lote_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos_decant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "movimientos_decant_lote" ADD CONSTRAINT "movimientos_decant_lote_lote_origen_id_fkey" FOREIGN KEY ("lote_origen_id") REFERENCES "lotes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "movimientos_decant_lote" ADD CONSTRAINT "movimientos_decant_lote_lote_destino_id_fkey" FOREIGN KEY ("lote_destino_id") REFERENCES "lotes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
