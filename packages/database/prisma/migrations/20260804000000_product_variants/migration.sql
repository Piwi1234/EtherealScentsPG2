-- Atributos variables: sin variante (de siempre), múltiple sin precio (ej. sabores),
-- o con precio propio por valor (ej. tamaño). Solo aplica a atributos type = SELECT.
CREATE TYPE "attribute_variant_mode" AS ENUM ('NONE', 'MULTI_VALUE', 'PRICED_VARIANT');

ALTER TABLE "attributes" ADD COLUMN "variant_mode" "attribute_variant_mode" NOT NULL DEFAULT 'NONE';

-- Relajar la unicidad para permitir varias filas del mismo atributo en un producto
-- (necesario para atributos MULTI_VALUE, ej. un vape con 2 sabores).
DROP INDEX "product_attribute_values_product_id_attribute_id_key";
CREATE UNIQUE INDEX "product_attribute_values_product_id_attribute_id_option_id_key"
  ON "product_attribute_values"("product_id", "attribute_id", "option_id");

-- Variante con precio propio de un producto: su propio código, precio de compra y utilidad.
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_code" VARCHAR(7) NOT NULL,
    "purchase_price" DECIMAL(12,2) NOT NULL,
    "utility" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_variants_variant_code_key" ON "product_variants"("variant_code");

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Combinación de opciones (una por atributo PRICED_VARIANT) que define cada variante.
CREATE TABLE "product_variant_options" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "attribute_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,

    CONSTRAINT "product_variant_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_variant_options_variant_id_attribute_id_key"
  ON "product_variant_options"("variant_id", "attribute_id");

ALTER TABLE "product_variant_options" ADD CONSTRAINT "product_variant_options_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variant_options" ADD CONSTRAINT "product_variant_options_attribute_id_fkey"
  FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variant_options" ADD CONSTRAINT "product_variant_options_option_id_fkey"
  FOREIGN KEY ("option_id") REFERENCES "attribute_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
