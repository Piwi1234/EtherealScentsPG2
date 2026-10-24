-- Fecha del último cambio de estado: ordena el listado de proformas (más reciente primero).
ALTER TABLE "proformas" ADD COLUMN "estado_actualizado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: la última entrada del historial de cada proforma (o su fecha de creación si no tiene).
UPDATE "proformas" p
SET "estado_actualizado_at" = COALESCE(
  (SELECT MAX(h."fecha") FROM "proforma_historial" h WHERE h."proforma_id" = p."id"),
  p."created_at"
);

CREATE INDEX "proformas_estado_actualizado_at_idx" ON "proformas" ("estado_actualizado_at");
