-- AlterTable
ALTER TABLE "movimientos_cartera" ADD COLUMN     "proforma_id" UUID;

-- CreateIndex
CREATE INDEX "movimientos_cartera_proforma_id_idx" ON "movimientos_cartera"("proforma_id");

-- AddForeignKey
ALTER TABLE "movimientos_cartera" ADD CONSTRAINT "movimientos_cartera_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "proformas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
