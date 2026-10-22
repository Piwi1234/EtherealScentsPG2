-- proveedorId/paisProcedenciaId pasan de la cabecera de Proforma a cada línea (ProformaDetalle):
-- una misma compra (un mismo envío) puede traer productos de varios proveedores distintos. El país
-- de procedencia deja de guardarse (ni en la proforma ni en la línea) -- se consulta en vivo desde
-- Proveedor.paisProcedencia cuando hace falta, en vez de duplicarlo.

-- AlterTable: agrega proveedor_id a proforma_detalles.
ALTER TABLE "proforma_detalles" ADD COLUMN "proveedor_id" UUID;

-- Backfill: copia el proveedor que tenía la proforma (cabecera) a cada una de sus líneas, antes de
-- borrar la columna vieja. Solo aplica a compras con proveedor cargado -- las demás quedan en null,
-- igual que las líneas de venta.
UPDATE "proforma_detalles" pd
SET "proveedor_id" = p."proveedor_id"
FROM "proformas" p
WHERE pd."proforma_id" = p."id" AND p."proveedor_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "proforma_detalles" ADD CONSTRAINT "proforma_detalles_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropForeignKey: proformas.proveedor_id / proformas.pais_procedencia_id ya no existen.
ALTER TABLE "proformas" DROP CONSTRAINT "proformas_proveedor_id_fkey";
ALTER TABLE "proformas" DROP CONSTRAINT "proformas_pais_procedencia_id_fkey";

-- AlterTable
ALTER TABLE "proformas" DROP COLUMN "proveedor_id";
ALTER TABLE "proformas" DROP COLUMN "pais_procedencia_id";
