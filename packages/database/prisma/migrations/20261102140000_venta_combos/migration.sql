-- Venta de combos en notas de venta: las líneas del combo se agrupan por combo (ver ProformaDetalle.comboId en schema.prisma).
ALTER TABLE "proforma_detalles" ADD COLUMN "combo_id" UUID;
ALTER TABLE "proforma_detalles" ADD COLUMN "combo_nombre" TEXT;
ALTER TABLE "proforma_detalles" ADD COLUMN "combo_unidades" INTEGER;
ALTER TABLE "proforma_detalles" ADD CONSTRAINT "proforma_detalles_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "proforma_detalles_combo_id_idx" ON "proforma_detalles"("combo_id");
