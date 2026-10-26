-- Stock "En tránsito": unidades "para stock" que viajan en envíos ya despachados hacia un almacén
-- (todavía no son físicas) y la parte de eso que ya reservaron ventas aprobadas. Las filas existentes
-- quedan en 0.

-- AlterTable
ALTER TABLE "stock" ADD COLUMN "cantidad_en_transito" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "stock" ADD COLUMN "cantidad_reservada_transito" INTEGER NOT NULL DEFAULT 0;

-- CheckConstraint (agregado a mano: Prisma no expresa CHECK en el schema DSL)
ALTER TABLE "stock" ADD CONSTRAINT "stock_transito_check"
  CHECK ("cantidad_en_transito" >= 0 AND "cantidad_reservada_transito" >= 0 AND "cantidad_reservada_transito" <= "cantidad_en_transito");

-- CheckConstraint: una asignación PROCURA nunca tiene almacén; STOCK y EN_TRANSITO siempre lo tienen.
ALTER TABLE "proforma_detalle_asignaciones" DROP CONSTRAINT "proforma_detalle_asignaciones_origen_almacen_check";
ALTER TABLE "proforma_detalle_asignaciones" ADD CONSTRAINT "proforma_detalle_asignaciones_origen_almacen_check"
  CHECK (("origen" = 'PROCURA' AND "almacen_id" IS NULL) OR ("origen" IN ('STOCK', 'EN_TRANSITO') AND "almacen_id" IS NOT NULL));
