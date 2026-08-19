-- Código corto y trackeable por proforma (no secuencial), mismo mecanismo que productCode/variantCode.

-- 1. Columna nullable primero para poder backfillear las filas existentes.
ALTER TABLE "proformas" ADD COLUMN "codigo" TEXT;

-- 2. Backfill: código alfanumérico de 7 (hex de un md5 con suficiente entropía por fila para que la
-- probabilidad de colisión sobre el puñado de filas ya existentes sea nula). Las filas nuevas usan
-- generateUniqueEntityCode desde la app (charset A-Z0-9), este backfill es solo para no dejar nulls.
UPDATE "proformas"
SET "codigo" = UPPER(SUBSTRING(MD5("id"::text || clock_timestamp()::text || random()::text), 1, 7))
WHERE "codigo" IS NULL;

-- 3. Ya no puede quedar nula ninguna fila nueva, y es único global (no por tipo).
ALTER TABLE "proformas" ALTER COLUMN "codigo" SET NOT NULL;
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_codigo_key" UNIQUE ("codigo");
