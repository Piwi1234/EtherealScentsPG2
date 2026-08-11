-- DropForeignKey
ALTER TABLE "almacenes" DROP CONSTRAINT "almacenes_ciudad_id_fkey";

-- AlterTable
ALTER TABLE "almacenes" DROP COLUMN "ciudad_id";
