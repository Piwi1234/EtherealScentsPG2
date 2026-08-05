-- Renombra monto_adelanto (monto fijo) a adelanto_porcentaje (% del total, calculado en vivo en el
-- frontend). Campo informativo, sin datos reales que preservar (el único valor no nulo era "0").
ALTER TABLE "proformas" RENAME COLUMN "monto_adelanto" TO "adelanto_porcentaje";
ALTER TABLE "proformas" ALTER COLUMN "adelanto_porcentaje" TYPE DECIMAL(5,2);

-- CheckConstraint (agregado a mano: Prisma 6.19 no expresa CHECK en el schema DSL)
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_adelanto_porcentaje_check"
  CHECK ("adelanto_porcentaje" IS NULL OR ("adelanto_porcentaje" >= 0 AND "adelanto_porcentaje" <= 100));
