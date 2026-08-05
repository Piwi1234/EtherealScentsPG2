-- DropIndex
DROP INDEX "lotes_compra_proforma_detalle_id_key";

-- CreateIndex
CREATE INDEX "lotes_compra_proforma_detalle_id_idx" ON "lotes_compra"("proforma_detalle_id");
