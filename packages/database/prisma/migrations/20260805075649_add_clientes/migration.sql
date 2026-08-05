-- CreateEnum
CREATE TYPE "tipo_cliente" AS ENUM ('NATURAL', 'JURIDICA');

-- CreateEnum
CREATE TYPE "tipo_documento" AS ENUM ('DNI', 'CI', 'RUC', 'PASAPORTE', 'OTRO');

-- CreateEnum
CREATE TYPE "origen_cliente" AS ENUM ('MANUAL', 'WEB');

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "tipo" "tipo_cliente" NOT NULL DEFAULT 'NATURAL',
    "nombre" TEXT NOT NULL,
    "tipo_documento" "tipo_documento" NOT NULL,
    "numero_documento" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "origen" "origen_cliente" NOT NULL DEFAULT 'MANUAL',
    "creado_por_id" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_numero_documento_key" ON "clientes"("numero_documento");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
