-- Categorías: costos heredados por sus productos (solo tienen sentido en subcategorías).
ALTER TABLE "categories"
  ADD COLUMN "logistics_cost" DECIMAL(12,2),
  ADD COLUMN "shipping_cost" DECIMAL(12,2),
  ADD COLUMN "security_cost" DECIMAL(12,2);

-- Productos: nueva utilidad manual.
ALTER TABLE "products"
  ADD COLUMN "utility" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Reemplazo de "sku" (texto libre) por "product_code" (autogenerado, 7 caracteres).
ALTER TABLE "products" ADD COLUMN "product_code" VARCHAR(7);

-- Backfill para las filas existentes: código derivado del id, único por fila.
UPDATE "products" SET "product_code" = UPPER(SUBSTR(MD5(id::text), 1, 7));

ALTER TABLE "products" ALTER COLUMN "product_code" SET NOT NULL;

DROP INDEX "products_sku_key";
ALTER TABLE "products" DROP COLUMN "sku";

CREATE UNIQUE INDEX "products_product_code_key" ON "products"("product_code");
