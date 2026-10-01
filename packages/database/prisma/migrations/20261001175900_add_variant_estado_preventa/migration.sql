-- CreateEnum
CREATE TYPE "estado_variante" AS ENUM ('DISPONIBLE', 'NO_DISPONIBLE', 'PREVENTA');

-- AlterTable: columna nueva primero (con default, para no romper filas existentes), backfill desde
-- el booleano viejo, recién después se borra "disponible" — así no se pierde el valor de ninguna
-- variante ya cargada.
ALTER TABLE "product_variants" ADD COLUMN "estado" "estado_variante" NOT NULL DEFAULT 'DISPONIBLE';

UPDATE "product_variants"
SET "estado" = CASE WHEN "disponible" THEN 'DISPONIBLE' ELSE 'NO_DISPONIBLE' END::"estado_variante";

ALTER TABLE "product_variants" DROP COLUMN "disponible";
