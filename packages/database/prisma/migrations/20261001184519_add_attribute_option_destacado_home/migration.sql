-- AlterTable
ALTER TABLE "attribute_options" ADD COLUMN     "destacado_home" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orden_destacado" INTEGER NOT NULL DEFAULT 0;
