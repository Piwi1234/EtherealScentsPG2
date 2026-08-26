-- AlterTable
ALTER TABLE "products" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
