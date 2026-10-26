-- Seguimiento separado: cada línea de COMPRA es "para stock" o "pedido de cliente", y un pedido se
-- liga a las asignaciones PROCURA (faltantes de notas de venta aprobadas) que viene a cubrir. Las
-- líneas existentes quedan como STOCK (el valor por defecto) y las PROCURA existentes sin ligar.

-- CreateEnum
CREATE TYPE "destino_compra" AS ENUM ('STOCK', 'PEDIDO');

-- AlterTable
ALTER TABLE "proforma_detalles" ADD COLUMN "destino" "destino_compra" NOT NULL DEFAULT 'STOCK';

-- AlterTable
ALTER TABLE "proforma_detalle_asignaciones" ADD COLUMN "compra_detalle_id" UUID;

-- CreateIndex
CREATE INDEX "proforma_detalle_asignaciones_compra_detalle_id_idx" ON "proforma_detalle_asignaciones"("compra_detalle_id");

-- AddForeignKey
ALTER TABLE "proforma_detalle_asignaciones" ADD CONSTRAINT "proforma_detalle_asignaciones_compra_detalle_id_fkey" FOREIGN KEY ("compra_detalle_id") REFERENCES "proforma_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
