-- La cuenta por cobrar nace al APROBAR la venta (no al completarla) para poder darle seguimiento
-- mientras está aprobada y también después de completada. Guarda además el total de la venta, para
-- mostrar total / pagado / saldo sin recalcular desde las líneas.
ALTER TABLE "cuentas_por_cobrar" ADD COLUMN "monto_total" DECIMAL(14,2);

-- Cuentas existentes (ventas completadas): el total sale de las líneas menos el descuento general.
UPDATE "cuentas_por_cobrar" c
SET "monto_total" = (
  SELECT COALESCE((SELECT SUM(d."subtotal") FROM "proforma_detalles" d WHERE d."proforma_id" = p."id"), 0) - p."descuento_general"
  FROM "proformas" p WHERE p."id" = c."proforma_id"
);

ALTER TABLE "cuentas_por_cobrar" ALTER COLUMN "monto_total" SET NOT NULL;

-- Ventas ya aprobadas que todavía no tienen cuenta: se crean con lo que falta cobrar (total menos el
-- neto de ingresos y reversos de cartera ligados a la proforma).
INSERT INTO "cuentas_por_cobrar" ("id", "proforma_id", "monto_total", "monto_adeudado", "estado", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  p."id",
  t."total",
  t."total" - COALESCE(m."pagado", 0),
  CASE WHEN t."total" - COALESCE(m."pagado", 0) <= 0 THEN 'COMPLETADO' ELSE 'PENDIENTE' END::"estado_cuenta_por_cobrar",
  now(),
  now()
FROM "proformas" p
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(d."subtotal"), 0) - p."descuento_general" AS "total"
  FROM "proforma_detalles" d WHERE d."proforma_id" = p."id"
) t
LEFT JOIN LATERAL (
  SELECT SUM(CASE WHEN mc."naturaleza" = 'INGRESO' THEN mc."monto" ELSE -mc."monto" END) AS "pagado"
  FROM "movimientos_cartera" mc WHERE mc."proforma_id" = p."id"
) m ON true
WHERE p."tipo" = 'VENTA'
  AND p."estado" = 'APROBADA'
  AND NOT EXISTS (SELECT 1 FROM "cuentas_por_cobrar" c WHERE c."proforma_id" = p."id");
