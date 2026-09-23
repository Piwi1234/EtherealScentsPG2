-- Add May pasa de cargarse en bolívares a cargarse en dólares (se convierte al tipo de cambio del
-- sistema al sumarse al precio, ver apps/api/src/catalog/product-price.ts). Los valores existentes
-- estaban en Bs, así que se resetean a NULL en vez de convertirse — se vuelven a cargar a mano en $.
UPDATE "products" SET "min_price_bs" = NULL WHERE "min_price_bs" IS NOT NULL;
UPDATE "product_variants" SET "min_price_bs" = NULL WHERE "min_price_bs" IS NOT NULL;
