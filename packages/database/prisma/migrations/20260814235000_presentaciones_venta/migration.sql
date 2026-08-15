-- CreateEnum
CREATE TYPE "unidad_variante" AS ENUM ('PZA', 'ML');

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN "unidad" "unidad_variante" NOT NULL DEFAULT 'PZA';

-- CreateTable
CREATE TABLE "presentaciones_venta" (
    "id" UUID NOT NULL,
    "variante_id" UUID NOT NULL,
    "cantidad_ml" INTEGER NOT NULL,
    "precio_venta_bs" DECIMAL(12,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentaciones_venta_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "proforma_detalles" ADD COLUMN "presentacion_venta_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "presentaciones_venta_variante_id_cantidad_ml_key" ON "presentaciones_venta"("variante_id", "cantidad_ml");

-- AddForeignKey
ALTER TABLE "presentaciones_venta" ADD CONSTRAINT "presentaciones_venta_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_detalles" ADD CONSTRAINT "proforma_detalles_presentacion_venta_id_fkey" FOREIGN KEY ("presentacion_venta_id") REFERENCES "presentaciones_venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
