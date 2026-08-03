-- "price" (precio de venta manual) se reemplaza por "purchase_price" (precio de compra),
-- que ahora es la base de la fórmula: purchase_price + costos heredados + utility = precio $.
ALTER TABLE "products" ADD COLUMN "purchase_price" DECIMAL(12,2);

-- Backfill: se parte del precio de venta actual como valor inicial de precio de compra.
UPDATE "products" SET "purchase_price" = "price";

ALTER TABLE "products" ALTER COLUMN "purchase_price" SET NOT NULL;
ALTER TABLE "products" DROP COLUMN "price";
