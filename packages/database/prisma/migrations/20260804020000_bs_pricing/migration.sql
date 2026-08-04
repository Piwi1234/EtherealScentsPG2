-- Configuración global del sistema (tipo de cambio $ -> Bs).
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "exchange_rate" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- Precios en bolívares de productos y variantes: Precio Min Bs (manual, opcional) y Descuento Bs
-- (manual). Precio May Bs y Precio Final Bs se calculan en vivo, no se persisten.
ALTER TABLE "products" ADD COLUMN "min_price_bs" DECIMAL(12,2);
ALTER TABLE "products" ADD COLUMN "discount_bs" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "product_variants" ADD COLUMN "min_price_bs" DECIMAL(12,2);
ALTER TABLE "product_variants" ADD COLUMN "discount_bs" DECIMAL(12,2) NOT NULL DEFAULT 0;
