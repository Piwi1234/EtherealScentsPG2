-- AlterTable
ALTER TABLE "attributes" ADD COLUMN     "mostrar_en_proforma" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0;
