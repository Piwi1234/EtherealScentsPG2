-- AlterTable
ALTER TABLE "proformas" ADD COLUMN "proveedor_id" UUID;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
