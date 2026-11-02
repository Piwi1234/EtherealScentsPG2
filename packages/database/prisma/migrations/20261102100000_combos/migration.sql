-- Combos: 2 a 4 productos de una misma categoría vendidos juntos con un descuento fijo en Bs (ver Combo en schema.prisma).
CREATE TABLE "combos" (
  "id" UUID NOT NULL,
  "nombre" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "combo_code" VARCHAR(7) NOT NULL,
  "category_id" UUID NOT NULL,
  "descripcion" TEXT,
  "descuento_bs" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "image_url" TEXT,
  "publicado" BOOLEAN NOT NULL DEFAULT false,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "combos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "combos_descuento_bs_check" CHECK ("descuento_bs" >= 0)
);

CREATE UNIQUE INDEX "combos_slug_key" ON "combos"("slug");
CREATE UNIQUE INDEX "combos_combo_code_key" ON "combos"("combo_code");
CREATE INDEX "combos_category_id_idx" ON "combos"("category_id");
ALTER TABLE "combos" ADD CONSTRAINT "combos_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "combo_items" (
  "id" UUID NOT NULL,
  "combo_id" UUID NOT NULL,
  "variante_id" UUID NOT NULL,
  "cantidad" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "combo_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "combo_items_cantidad_check" CHECK ("cantidad" >= 1)
);

CREATE UNIQUE INDEX "combo_items_combo_id_variante_id_key" ON "combo_items"("combo_id", "variante_id");
CREATE INDEX "combo_items_variante_id_idx" ON "combo_items"("variante_id");
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
