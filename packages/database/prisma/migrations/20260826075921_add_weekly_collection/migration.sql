-- AlterEnum
ALTER TYPE "CarouselKind" ADD VALUE 'WEEKLY_COLLECTION_BANNER';

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "weekly_collection_brand_id" UUID;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_weekly_collection_brand_id_fkey" FOREIGN KEY ("weekly_collection_brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
