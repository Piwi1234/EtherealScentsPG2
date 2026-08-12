-- Remapear filas existentes en estados que se eliminan, antes de reconstruir el enum: PENDIENTE pasa
-- a BORRADOR (mismo significado de negocio: todavía no se aprobó), RECHAZADA pasa a ANULADA (salida
-- terminal negativa más cercana entre las que quedan).
UPDATE "proformas" SET "estado" = 'BORRADOR' WHERE "estado" = 'PENDIENTE';
UPDATE "proformas" SET "estado" = 'ANULADA' WHERE "estado" = 'RECHAZADA';
UPDATE "proforma_historial" SET "estado" = 'BORRADOR' WHERE "estado" = 'PENDIENTE';
UPDATE "proforma_historial" SET "estado" = 'ANULADA' WHERE "estado" = 'RECHAZADA';

-- Reconstruir estado_proforma sin PENDIENTE/RECHAZADA (Postgres no soporta DROP VALUE en un enum).
ALTER TYPE "estado_proforma" RENAME TO "estado_proforma_old";
CREATE TYPE "estado_proforma" AS ENUM ('BORRADOR', 'APROBADA', 'COMPLETADA', 'ANULADA');

ALTER TABLE "proformas" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "proformas" ALTER COLUMN "estado" TYPE "estado_proforma" USING ("estado"::text::"estado_proforma");
ALTER TABLE "proformas" ALTER COLUMN "estado" SET DEFAULT 'BORRADOR';

ALTER TABLE "proforma_historial" ALTER COLUMN "estado" TYPE "estado_proforma" USING ("estado"::text::"estado_proforma");

DROP TYPE "estado_proforma_old";

-- Proforma.almacenRecepcionId -> Proforma.almacenId (ahora compartido por COMPRA y VENTA, fijado en
-- momentos distintos: VENTA al aprobar, COMPRA al completar).
ALTER TABLE "proformas" RENAME COLUMN "almacen_recepcion_id" TO "almacen_id";
ALTER TABLE "proformas" RENAME CONSTRAINT "proformas_almacen_recepcion_id_fkey" TO "proformas_almacen_id_fkey";

-- ProformaDetalle.almacenId por línea (agregado en una sesión anterior) se revierte: el almacén vuelve
-- a ser uno solo por proforma.
ALTER TABLE "proforma_detalles" DROP CONSTRAINT "proforma_detalles_almacen_id_fkey";
ALTER TABLE "proforma_detalles" DROP COLUMN "almacen_id";
