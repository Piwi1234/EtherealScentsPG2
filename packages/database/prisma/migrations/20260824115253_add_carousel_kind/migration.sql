-- CreateEnum
CREATE TYPE "CarouselKind" AS ENUM ('FEATURE', 'CATEGORY_HERO');

-- DropIndex
DROP INDEX "carousel_images_category_id_orden_idx";

-- AlterTable
ALTER TABLE "carousel_images" ADD COLUMN     "kind" "CarouselKind" NOT NULL DEFAULT 'FEATURE';

-- CreateIndex
CREATE INDEX "carousel_images_category_id_kind_orden_idx" ON "carousel_images"("category_id", "kind", "orden");
