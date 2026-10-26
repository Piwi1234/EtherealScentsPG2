-- Solicitudes de stock: lo que se quiere tener en inventario sin que lo pida una venta. Aparecen en
-- Seguimiento junto a los faltantes de clientes y se compran con "Crear compras". Cada línea puede ligarse
-- (parcial o completa) a una línea de compra, igual que los faltantes de ventas.
CREATE TYPE "estado_solicitud_stock" AS ENUM ('ABIERTA', 'CANCELADA');

CREATE TABLE "solicitudes_stock" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "estado" "estado_solicitud_stock" NOT NULL DEFAULT 'ABIERTA',
    "nota" TEXT,
    "creado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_stock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "solicitudes_stock_codigo_key" ON "solicitudes_stock"("codigo");
CREATE INDEX "solicitudes_stock_estado_idx" ON "solicitudes_stock"("estado");

CREATE TABLE "solicitud_stock_lineas" (
    "id" UUID NOT NULL,
    "solicitud_id" UUID NOT NULL,
    "variante_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "nota" TEXT,
    "compra_detalle_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_stock_lineas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "solicitud_stock_lineas_cantidad_check" CHECK ("cantidad" > 0)
);

CREATE INDEX "solicitud_stock_lineas_solicitud_id_idx" ON "solicitud_stock_lineas"("solicitud_id");
CREATE INDEX "solicitud_stock_lineas_variante_id_idx" ON "solicitud_stock_lineas"("variante_id");
CREATE INDEX "solicitud_stock_lineas_compra_detalle_id_idx" ON "solicitud_stock_lineas"("compra_detalle_id");

ALTER TABLE "solicitudes_stock"
  ADD CONSTRAINT "solicitudes_stock_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "solicitud_stock_lineas"
  ADD CONSTRAINT "solicitud_stock_lineas_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes_stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "solicitud_stock_lineas"
  ADD CONSTRAINT "solicitud_stock_lineas_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud_stock_lineas"
  ADD CONSTRAINT "solicitud_stock_lineas_compra_detalle_id_fkey" FOREIGN KEY ("compra_detalle_id") REFERENCES "proforma_detalles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
