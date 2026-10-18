-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "promo_modal_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promo_modal_image_url" TEXT,
ADD COLUMN     "promo_modal_url" TEXT;
