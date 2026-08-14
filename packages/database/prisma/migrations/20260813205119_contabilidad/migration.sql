-- CreateEnum
CREATE TYPE "moneda_cartera" AS ENUM ('BS', 'USDT', 'GS', 'CLP', 'USD');

-- CreateEnum
CREATE TYPE "naturaleza_movimiento" AS ENUM ('INGRESO', 'GASTO');

-- CreateTable
CREATE TABLE "carteras" (
    "id" UUID NOT NULL,
    "moneda" "moneda_cartera" NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "saldo_actual" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carteras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_movimiento" (
    "id" UUID NOT NULL,
    "cartera_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "naturaleza" "naturaleza_movimiento" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_cartera" (
    "id" UUID NOT NULL,
    "cartera_id" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "detalle" TEXT NOT NULL,
    "naturaleza" "naturaleza_movimiento" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "tipo_movimiento_id" UUID,
    "traspaso_id" UUID,
    "creado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_cartera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traspasos" (
    "id" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "cartera_origen_id" UUID NOT NULL,
    "cartera_destino_id" UUID NOT NULL,
    "monto_origen" DECIMAL(14,2) NOT NULL,
    "tipo_cambio" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "monto_destino" DECIMAL(14,2) NOT NULL,
    "nota" TEXT,
    "creado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "traspasos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carteras_moneda_nombre_key" ON "carteras"("moneda", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_movimiento_cartera_id_nombre_naturaleza_key" ON "tipos_movimiento"("cartera_id", "nombre", "naturaleza");

-- CreateIndex
CREATE INDEX "movimientos_cartera_cartera_id_fecha_idx" ON "movimientos_cartera"("cartera_id", "fecha");

-- AddForeignKey
ALTER TABLE "tipos_movimiento" ADD CONSTRAINT "tipos_movimiento_cartera_id_fkey" FOREIGN KEY ("cartera_id") REFERENCES "carteras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_cartera" ADD CONSTRAINT "movimientos_cartera_cartera_id_fkey" FOREIGN KEY ("cartera_id") REFERENCES "carteras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_cartera" ADD CONSTRAINT "movimientos_cartera_tipo_movimiento_id_fkey" FOREIGN KEY ("tipo_movimiento_id") REFERENCES "tipos_movimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_cartera" ADD CONSTRAINT "movimientos_cartera_traspaso_id_fkey" FOREIGN KEY ("traspaso_id") REFERENCES "traspasos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_cartera" ADD CONSTRAINT "movimientos_cartera_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos" ADD CONSTRAINT "traspasos_cartera_origen_id_fkey" FOREIGN KEY ("cartera_origen_id") REFERENCES "carteras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos" ADD CONSTRAINT "traspasos_cartera_destino_id_fkey" FOREIGN KEY ("cartera_destino_id") REFERENCES "carteras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traspasos" ADD CONSTRAINT "traspasos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
