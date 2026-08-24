-- Los valores de estas columnas ya se copiaron a "carousel_images" (ver script de migración de
-- datos corrido a mano entre esta migración y la anterior, 20260824094428_add_carousel_images).
-- AlterTable
ALTER TABLE "categories" DROP COLUMN "hero_image_url";

-- AlterTable
ALTER TABLE "system_settings" DROP COLUMN "hero_image_url";
