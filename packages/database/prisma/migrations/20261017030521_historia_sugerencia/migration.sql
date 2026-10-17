-- CreateEnum
CREATE TYPE "historia_sugerencia_tipo" AS ENUM ('CASA', 'PERFUMES', 'INGREDIENTE');

-- AlterTable
ALTER TABLE "historias" ADD COLUMN     "sugerencia_attribute_option_id" UUID,
ADD COLUMN     "sugerencia_brand_id" UUID,
ADD COLUMN     "sugerencia_tipo" "historia_sugerencia_tipo";

-- CreateTable
CREATE TABLE "historia_sugerencia_productos" (
    "historia_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "historia_sugerencia_productos_pkey" PRIMARY KEY ("historia_id","product_id")
);

-- AddForeignKey
ALTER TABLE "historias" ADD CONSTRAINT "historias_sugerencia_brand_id_fkey" FOREIGN KEY ("sugerencia_brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historias" ADD CONSTRAINT "historias_sugerencia_attribute_option_id_fkey" FOREIGN KEY ("sugerencia_attribute_option_id") REFERENCES "attribute_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historia_sugerencia_productos" ADD CONSTRAINT "historia_sugerencia_productos_historia_id_fkey" FOREIGN KEY ("historia_id") REFERENCES "historias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historia_sugerencia_productos" ADD CONSTRAINT "historia_sugerencia_productos_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
