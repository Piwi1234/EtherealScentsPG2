-- CreateTable
CREATE TABLE "traspasos_almacen" (
    "id" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "variante_id" UUID NOT NULL,
    "almacen_origen_id" UUID NOT NULL,
    "almacen_destino_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "nota" TEXT,
    "creado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traspasos_almacen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traspasos_almacen_lote" (
    "id" UUID NOT NULL,
    "traspaso_id" UUID NOT NULL,
    "lote_origen_id" UUID NOT NULL,
    "lote_destino_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "traspasos_almacen_lote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "traspasos_almacen" ADD CONSTRAINT "traspasos_almacen_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos_almacen" ADD CONSTRAINT "traspasos_almacen_almacen_origen_id_fkey" FOREIGN KEY ("almacen_origen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos_almacen" ADD CONSTRAINT "traspasos_almacen_almacen_destino_id_fkey" FOREIGN KEY ("almacen_destino_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos_almacen" ADD CONSTRAINT "traspasos_almacen_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos_almacen_lote" ADD CONSTRAINT "traspasos_almacen_lote_traspaso_id_fkey" FOREIGN KEY ("traspaso_id") REFERENCES "traspasos_almacen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos_almacen_lote" ADD CONSTRAINT "traspasos_almacen_lote_lote_origen_id_fkey" FOREIGN KEY ("lote_origen_id") REFERENCES "lotes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos_almacen_lote" ADD CONSTRAINT "traspasos_almacen_lote_lote_destino_id_fkey" FOREIGN KEY ("lote_destino_id") REFERENCES "lotes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
