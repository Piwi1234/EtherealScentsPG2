-- Descuento por unidad en cada línea de venta. El descuento total de la nota (proformas.descuento_general)
-- pasa a ser la suma de cantidad × descuento_unitario, calculada por el servidor.
ALTER TABLE "proforma_detalles" ADD COLUMN "descuento_unitario" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Notas existentes con descuento general: se reparte entre sus líneas en proporción al subtotal, para que cada
-- línea tenga su descuento unitario. descuento_general no se toca (los totales ya registrados no cambian).
UPDATE "proforma_detalles" d
SET "descuento_unitario" = LEAST(
  d."precio_unitario",
  ROUND(p."descuento_general" * d."subtotal" / t."total" / d."cantidad", 2)
)
FROM "proformas" p
JOIN (
  SELECT "proforma_id", SUM("subtotal") AS "total" FROM "proforma_detalles" GROUP BY "proforma_id"
) t ON t."proforma_id" = p."id"
WHERE d."proforma_id" = p."id"
  AND p."tipo" = 'VENTA'
  AND p."descuento_general" > 0
  AND t."total" > 0
  AND d."cantidad" > 0
  AND d."precio_unitario" IS NOT NULL;
