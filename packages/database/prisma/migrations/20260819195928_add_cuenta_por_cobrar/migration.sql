-- CreateEnum
CREATE TYPE "estado_cuenta_por_cobrar" AS ENUM ('PENDIENTE', 'COMPLETADO');

-- CreateTable
CREATE TABLE "cuentas_por_cobrar" (
    "id" UUID NOT NULL,
    "proforma_id" UUID NOT NULL,
    "monto_adeudado" DECIMAL(14,2) NOT NULL,
    "estado" "estado_cuenta_por_cobrar" NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_por_cobrar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_por_cobrar_proforma_id_key" ON "cuentas_por_cobrar"("proforma_id");

-- CreateIndex
CREATE INDEX "cuentas_por_cobrar_estado_idx" ON "cuentas_por_cobrar"("estado");

-- AddForeignKey
ALTER TABLE "cuentas_por_cobrar" ADD CONSTRAINT "cuentas_por_cobrar_proforma_id_fkey" FOREIGN KEY ("proforma_id") REFERENCES "proformas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
