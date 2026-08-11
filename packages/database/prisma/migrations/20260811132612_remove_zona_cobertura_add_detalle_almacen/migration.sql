-- DropTable
DROP TABLE "zonas_cobertura";

-- AlterTable
ALTER TABLE "proforma_detalles" ADD COLUMN     "almacen_id" UUID;

-- AddForeignKey
ALTER TABLE "proforma_detalles" ADD CONSTRAINT "proforma_detalles_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
