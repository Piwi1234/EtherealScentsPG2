-- Una nota de compra por proveedor: el proveedor pasa a la cabecera de la compra. El proveedor de cada
-- línea (proforma_detalles.proveedor_id) se conserva y se mantiene igual al de la cabecera, así los
-- reportes que lo leen por línea (Registros) siguen funcionando.
ALTER TABLE "proformas" ADD COLUMN "proveedor_id" UUID;

ALTER TABLE "proformas"
  ADD CONSTRAINT "proformas_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "proformas_proveedor_id_idx" ON "proformas"("proveedor_id");

-- Compras existentes cuyas líneas son todas de un único proveedor: ese pasa a ser el de la cabecera.
-- Las que mezclan proveedores quedan sin proveedor de cabecera ("Varios") y conservan el de cada línea.
UPDATE "proformas" p
SET "proveedor_id" = s."proveedor_id"
FROM (
  SELECT d."proforma_id", MIN(d."proveedor_id"::text)::uuid AS "proveedor_id"
  FROM "proforma_detalles" d
  WHERE d."proveedor_id" IS NOT NULL
  GROUP BY d."proforma_id"
  HAVING COUNT(DISTINCT d."proveedor_id") = 1
) s
WHERE s."proforma_id" = p."id" AND p."tipo" = 'COMPRA';

-- Líneas sin proveedor en una compra que ya tiene uno de cabecera: heredan el de la cabecera.
UPDATE "proforma_detalles" d
SET "proveedor_id" = p."proveedor_id"
FROM "proformas" p
WHERE d."proforma_id" = p."id" AND p."proveedor_id" IS NOT NULL AND d."proveedor_id" IS NULL;
