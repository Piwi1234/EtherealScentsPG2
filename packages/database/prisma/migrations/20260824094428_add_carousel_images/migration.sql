-- CreateTable
CREATE TABLE "carousel_images" (
    "id" UUID NOT NULL,
    "category_id" UUID,
    "image_url" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carousel_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carousel_images_category_id_orden_idx" ON "carousel_images"("category_id", "orden");

-- AddForeignKey
ALTER TABLE "carousel_images" ADD CONSTRAINT "carousel_images_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
