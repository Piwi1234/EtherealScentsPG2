-- CreateEnum
CREATE TYPE "tipo_empresa" AS ENUM ('CASA_MATRIZ', 'SUCURSAL');

-- CreateEnum
CREATE TYPE "tipo_proforma" AS ENUM ('COMPRA', 'VENTA');

-- CreateEnum
CREATE TYPE "estado_proforma" AS ENUM ('BORRADOR', 'PENDIENTE', 'APROBADA', 'COMPLETADA', 'RECHAZADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "origen_asignacion" AS ENUM ('STOCK', 'PROCURA');

-- CreateEnum
CREATE TYPE "estado_seguimiento" AS ENUM ('PENDIENTE', 'COMPRADO', 'ENVIADO', 'RECIBIDO');

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "ciudad_id" UUID;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ciudades" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ciudades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "tipo_empresa" NOT NULL,
    "razon_social" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "logo_url" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "almacenes" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "ciudad_id" UUID NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "almacenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zonas_cobertura" (
    "ciudad_id" UUID NOT NULL,
    "almacen_id" UUID NOT NULL,
    "prioridad" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zonas_cobertura_pkey" PRIMARY KEY ("ciudad_id","almacen_id")
);

-- CreateTable
CREATE TABLE "stock" (
    "variante_id" UUID NOT NULL,
    "almacen_id" UUID NOT NULL,
    "cantidad_fisica" INTEGER NOT NULL DEFAULT 0,
    "cantidad_reservada" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_pkey" PRIMARY KEY ("variante_id","almacen_id")
);

-- CreateTable
CREATE TABLE "lotes_compra" (
    "id" UUID NOT NULL,
    "variante_id" UUID NOT NULL,
    "almacen_id" UUID NOT NULL,
    "proforma_detalle_id" UUID NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "cantidad_inicial" INTEGER NOT NULL,
    "cantidad_disponible" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lotes_compra_consumo" (
    "id" UUID NOT NULL,
    "lote_compra_id" UUID NOT NULL,
    "proforma_detalle_asignacion_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_compra_consumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proformas" (
    "id" UUID NOT NULL,
    "tipo" "tipo_proforma" NOT NULL,
    "estado" "estado_proforma" NOT NULL DEFAULT 'BORRADOR',
    "empresa_id" UUID NOT NULL,
    "cliente_id" UUID,
    "almacen_recepcion_id" UUID,
    "ciudad_entrega_id" UUID,
    "creado_por_id" UUID NOT NULL,
    "descuento_general" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monto_adelanto" DECIMAL(12,2),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proformas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_detalles" (
    "id" UUID NOT NULL,
    "proforma_id" UUID NOT NULL,
    "variante_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(12,2),
    "precio_compra" DECIMAL(12,2),
    "costo_envio" DECIMAL(12,2),
    "costo_seguridad" DECIMAL(12,2),
    "costo_logistica" DECIMAL(12,2),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proforma_detalles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_detalle_asignaciones" (
    "id" UUID NOT NULL,
    "proforma_detalle_id" UUID NOT NULL,
    "almacen_id" UUID,
    "cantidad" INTEGER NOT NULL,
    "origen" "origen_asignacion" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proforma_detalle_asignaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_historial" (
    "id" UUID NOT NULL,
    "proforma_id" UUID NOT NULL,
    "estado" "estado_proforma" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID NOT NULL,
    "nota" TEXT,

    CONSTRAINT "proforma_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_detalle_seguimiento" (
    "id" UUID NOT NULL,
    "proforma_detalle_id" UUID NOT NULL,
    "estado" "estado_seguimiento" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" UUID NOT NULL,
    "nota" TEXT,

    CONSTRAINT "proforma_detalle_seguimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ciudades_nombre_key" ON "ciudades"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "empresas_nit_key" ON "empresas"("nit");

-- CreateIndex
CREATE UNIQUE INDEX "zonas_cobertura_ciudad_id_prioridad_key" ON "zonas_cobertura"("ciudad_id", "prioridad");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_compra_proforma_detalle_id_key" ON "lotes_compra"("proforma_detalle_id");

-- CreateIndex
CREATE INDEX "lotes_compra_variante_id_almacen_id_fecha_idx" ON "lotes_compra"("variante_id", "almacen_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "lotes_compra_consumo_lote_compra_id_proforma_detalle_asigna_key" ON "lotes_compra_consumo"("lote_compra_id", "proforma_detalle_asignacion_id");

-- CreateIndex
CREATE INDEX "proformas_tipo_estado_idx" ON "proformas"("tipo", "estado");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_ciudad_id_fkey" FOREIGN KEY ("ciudad_id") REFERENCES "ciudades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "almacenes" ADD CONSTRAINT "almacenes_ciudad_id_fkey" FOREIGN KEY ("ciudad_id") REFERENCES "ciudades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zonas_cobertura" ADD CONSTRAINT "zonas_cobertura_ciudad_id_fkey" FOREIGN KEY ("ciudad_id") REFERENCES "ciudades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zonas_cobertura" ADD CONSTRAINT "zonas_cobertura_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_compra" ADD CONSTRAINT "lotes_compra_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_compra" ADD CONSTRAINT "lotes_compra_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_compra" ADD CONSTRAINT "lotes_compra_proforma_detalle_id_fkey" FOREIGN KEY ("proforma_detalle_id") REFERENCES "proforma_detalles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_compra_consumo" ADD CONSTRAINT "lotes_compra_consumo_lote_compra_id_fkey" FOREIGN KEY ("lote_compra_id") REFERENCES "lotes_compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_compra_consumo" ADD CONSTRAINT "lotes_compra_consumo_proforma_detalle_asignacion_id_fkey" FOREIGN KEY ("proforma_detalle_asignacion_id") REFERENCES "proforma_detalle_asignaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_almacen_recepcion_id_fkey" FOREIGN KEY ("almacen_recepcion_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_ciudad_entrega_id_fkey" FOREIGN KEY ("ciudad_entrega_id") REFERENCES "ciudades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_detalles" ADD CONSTRAINT "proforma_detalles_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "proformas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_detalles" ADD CONSTRAINT "proforma_detalles_variante_id_fkey" FOREIGN KEY ("variante_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_detalle_asignaciones" ADD CONSTRAINT "proforma_detalle_asignaciones_proforma_detalle_id_fkey" FOREIGN KEY ("proforma_detalle_id") REFERENCES "proforma_detalles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_detalle_asignaciones" ADD CONSTRAINT "proforma_detalle_asignaciones_almacen_id_fkey" FOREIGN KEY ("almacen_id") REFERENCES "almacenes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_historial" ADD CONSTRAINT "proforma_historial_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "proformas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_historial" ADD CONSTRAINT "proforma_historial_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_detalle_seguimiento" ADD CONSTRAINT "proforma_detalle_seguimiento_proforma_detalle_id_fkey" FOREIGN KEY ("proforma_detalle_id") REFERENCES "proforma_detalles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_detalle_seguimiento" ADD CONSTRAINT "proforma_detalle_seguimiento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint (agregado a mano: Prisma 6.19 no expresa CHECK en el schema DSL)
ALTER TABLE "stock" ADD CONSTRAINT "stock_cantidades_check"
  CHECK ("cantidad_fisica" >= 0 AND "cantidad_reservada" >= 0 AND "cantidad_reservada" <= "cantidad_fisica");

-- CheckConstraint: una venta siempre necesita cliente; una compra nunca lo tiene.
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_venta_requiere_cliente_check"
  CHECK ("tipo" != 'VENTA' OR "cliente_id" IS NOT NULL);

-- CheckConstraint: almacen_id nulo si y solo si el origen es PROCURA.
ALTER TABLE "proforma_detalle_asignaciones" ADD CONSTRAINT "proforma_detalle_asignaciones_origen_almacen_check"
  CHECK (("origen" = 'PROCURA' AND "almacen_id" IS NULL) OR ("origen" = 'STOCK' AND "almacen_id" IS NOT NULL));
