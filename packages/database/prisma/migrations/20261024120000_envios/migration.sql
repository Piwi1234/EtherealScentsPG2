-- Envíos: agrupan varias compras (de varios proveedores) que viajan juntas hacia un almacén. Una
-- compra solo se completa al confirmar la recepción de su envío. Las compras ya existentes quedan
-- sin envío (envio_id null) -- las COMPLETADAS conservan su historia, las APROBADAS se pueden
-- agregar a un envío nuevo.

-- CreateEnum
CREATE TYPE "estado_envio" AS ENUM ('ARMANDO', 'EN_TRANSITO', 'RECIBIDO', 'ANULADO');

-- CreateTable
CREATE TABLE "envios" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "estado_envio" NOT NULL DEFAULT 'ARMANDO',
    "almacen_destino_id" UUID NOT NULL,
    "nota" TEXT,
    "fecha_envio" TIMESTAMP(3),
    "fecha_recepcion" TIMESTAMP(3),
    "creado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envio_recepcion_lineas" (
    "id" UUID NOT NULL,
    "envio_id" UUID NOT NULL,
    "compra_detalle_id" UUID NOT NULL,
    "variante_esperada_id" UUID NOT NULL,
    "variante_recibida_id" UUID NOT NULL,
    "cantidad_esperada" INTEGER NOT NULL,
    "cantidad_recibida" INTEGER NOT NULL,
    "nota" TEXT,

    CONSTRAINT "envio_recepcion_lineas_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "proformas" ADD COLUMN "envio_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "envios_codigo_key" ON "envios"("codigo");

-- CreateIndex
CREATE INDEX "envios_estado_idx" ON "envios"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "envio_recepcion_lineas_envio_id_compra_detalle_id_key" ON "envio_recepcion_lineas"("envio_id", "compra_detalle_id");

-- CreateIndex
CREATE INDEX "proformas_envio_id_idx" ON "proformas"("envio_id");

-- AddForeignKey
ALTER TABLE "envios" ADD CONSTRAINT "envios_almacen_destino_id_fkey" FOREIGN KEY ("almacen_destino_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envios" ADD CONSTRAINT "envios_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_recepcion_lineas" ADD CONSTRAINT "envio_recepcion_lineas_envio_id_fkey" FOREIGN KEY ("envio_id") REFERENCES "envios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_recepcion_lineas" ADD CONSTRAINT "envio_recepcion_lineas_compra_detalle_id_fkey" FOREIGN KEY ("compra_detalle_id") REFERENCES "proforma_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_recepcion_lineas" ADD CONSTRAINT "envio_recepcion_lineas_variante_esperada_id_fkey" FOREIGN KEY ("variante_esperada_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envio_recepcion_lineas" ADD CONSTRAINT "envio_recepcion_lineas_variante_recibida_id_fkey" FOREIGN KEY ("variante_recibida_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_envio_id_fkey" FOREIGN KEY ("envio_id") REFERENCES "envios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
