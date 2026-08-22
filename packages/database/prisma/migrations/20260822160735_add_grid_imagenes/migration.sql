-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "hero_image_url" TEXT;

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "about_image_url" TEXT,
ADD COLUMN     "value_image_url" TEXT;
