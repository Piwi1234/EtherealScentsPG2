-- Entregas parciales de notas de venta aprobadas: unidades reservadas en stock físico que salen hacia el cliente.
CREATE TABLE "entregas_venta" (
    "id" UUID NOT NULL,
    "proforma_detalle_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "nota" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entregas_venta_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "entregas_venta_cantidad_check" CHECK ("cantidad" > 0)
);

CREATE INDEX "entregas_venta_proforma_detalle_id_idx" ON "entregas_venta"("proforma_detalle_id");

ALTER TABLE "entregas_venta" ADD CONSTRAINT "entregas_venta_proforma_detalle_id_fkey" FOREIGN KEY ("proforma_detalle_id") REFERENCES "proforma_detalles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entregas_venta" ADD CONSTRAINT "entregas_venta_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cada consumo de lote puede pertenecer a una entrega (entrega_id) o al completado final de la nota (nulo).
ALTER TABLE "lotes_compra_consumo" ADD COLUMN "entrega_id" UUID;
ALTER TABLE "lotes_compra_consumo" ADD CONSTRAINT "lotes_compra_consumo_entrega_id_fkey" FOREIGN KEY ("entrega_id") REFERENCES "entregas_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una asignación puede consumir el mismo lote en varias entregas y otra vez al completar: la unicidad pasa a ser parcial.
DROP INDEX "lotes_compra_consumo_lote_compra_id_proforma_detalle_asigna_key";
CREATE UNIQUE INDEX "lotes_compra_consumo_completado_key" ON "lotes_compra_consumo"("lote_compra_id", "proforma_detalle_asignacion_id") WHERE "entrega_id" IS NULL;
CREATE UNIQUE INDEX "lotes_compra_consumo_entrega_key" ON "lotes_compra_consumo"("lote_compra_id", "proforma_detalle_asignacion_id", "entrega_id") WHERE "entrega_id" IS NOT NULL;
CREATE INDEX "lotes_compra_consumo_lote_compra_id_idx" ON "lotes_compra_consumo"("lote_compra_id");
CREATE INDEX "lotes_compra_consumo_entrega_id_idx" ON "lotes_compra_consumo"("entrega_id");
