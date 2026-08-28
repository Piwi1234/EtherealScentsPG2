-- AlterTable
ALTER TABLE "attributes" ADD COLUMN     "mostrar_en_tarjeta" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orden_tarjeta" INTEGER NOT NULL DEFAULT 0;
