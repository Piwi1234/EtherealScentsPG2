-- MULTI_VALUE y PRICED_VARIANT dejan de compartir AttributeOption a nivel de categoría: sus valores
-- pasan a ser propios de cada producto (ej. 2 vapes con "Sabor" MULTI_VALUE tienen cada uno su propia
-- lista de sabores; 2 perfumes con "Tamaño" PRICED_VARIANT tienen cada uno su propia lista de tamaños
-- con su propio purchasePrice/utility/minPriceBs). El Attribute (nombre/tipo/variantMode) se sigue
-- definiendo a nivel de categoría exactamente igual que hoy: solo cambian los VALORES. Los atributos
-- NONE (select normal) no cambian en absoluto: siguen usando attribute_options tal cual.
CREATE TABLE "product_variant_option_values" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variant_option_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_variant_option_values_unique"
  ON "product_variant_option_values"("product_id", "attribute_id", "value");

ALTER TABLE "product_variant_option_values" ADD CONSTRAINT "product_variant_option_values_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variant_option_values" ADD CONSTRAINT "product_variant_option_values_attribute_id_fkey"
  FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- product_variant_options pasa de referenciar directamente Attribute+AttributeOption (compartidos a
-- nivel de categoría) a referenciar un único ProductVariantOptionValue (propio del producto de la
-- variante); el atributo queda implícito vía optionValue.attributeId. Hoy la tabla tiene 0 filas (0
-- variantes creadas todavía), así que esto es una reestructuración de tabla vacía, sin backfill.
ALTER TABLE "product_variant_options" DROP CONSTRAINT "product_variant_options_attribute_id_fkey";
ALTER TABLE "product_variant_options" DROP CONSTRAINT "product_variant_options_option_id_fkey";
DROP INDEX "product_variant_options_variant_id_attribute_id_key";

ALTER TABLE "product_variant_options" DROP COLUMN "attribute_id";
ALTER TABLE "product_variant_options" DROP COLUMN "option_id";
ALTER TABLE "product_variant_options" ADD COLUMN "option_value_id" UUID NOT NULL;

CREATE UNIQUE INDEX "product_variant_options_variant_id_option_value_id_key"
  ON "product_variant_options"("variant_id", "option_value_id");

ALTER TABLE "product_variant_options" ADD CONSTRAINT "product_variant_options_option_value_id_fkey"
  FOREIGN KEY ("option_value_id") REFERENCES "product_variant_option_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Limpieza: los atributos MULTI_VALUE/PRICED_VARIANT ya no usan attribute_options (sus valores ahora
-- se cargan por producto en product_variant_option_values). Hoy solo existen las 2 filas huérfanas de
-- "Tamaño" (100 ML / 50 ML), sin productos ni variantes que las usen. Se escribe como un DELETE
-- general (no atado a esos IDs puntuales) para que la migración sea correcta sin importar el estado
-- exacto de la base al aplicarse.
DELETE FROM "attribute_options"
  WHERE "attribute_id" IN (SELECT "id" FROM "attributes" WHERE "variant_mode" != 'NONE');
