-- CreateEnum
CREATE TYPE "tipo_movimiento_probador" AS ENUM ('CONVERSION', 'BAJA');

-- CreateTable
CREATE TABLE "movimientos_probador" (
    "id" UUID NOT NULL,
    "tipo" "tipo_movimiento_probador" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "variante_id" UUID NOT NULL,
    "almacen_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costo_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "nota" TEXT,
    "creado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_probador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_probador_lote" (
    "id" UUID NOT NULL,
    "movimiento_id" UUID NOT NULL,
    "lote_compra_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "movimientos_probador_lote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimientos_probador_variante_id_almacen_id_idx" ON "movimientos_probador"("variante_id", "almacen_id");

-- AddForeignKey
ALTER TABLE "movimientos_probador" ADD CONSTRAINT "movimientos_probador_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_probador" ADD CONSTRAINT "movimientos_probador_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_probador" ADD CONSTRAINT "movimientos_probador_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_probador_lote" ADD CONSTRAINT "movimientos_probador_lote_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos_probador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_probador_lote" ADD CONSTRAINT "movimientos_probador_lote_lote_compra_id_fkey" FOREIGN KEY ("lote_compra_id") REFERENCES "lotes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
