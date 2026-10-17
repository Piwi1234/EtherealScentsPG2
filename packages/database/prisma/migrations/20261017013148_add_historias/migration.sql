-- CreateEnum
CREATE TYPE "historia_categoria" AS ENUM ('CASAS', 'PERFUMISTAS', 'INGREDIENTES', 'FRAGANCIAS', 'APRENDE');

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "destacada_historia_id" UUID;

-- CreateTable
CREATE TABLE "historias" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "publicada" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historia_categorias" (
    "historia_id" UUID NOT NULL,
    "categoria" "historia_categoria" NOT NULL,

    CONSTRAINT "historia_categorias_pkey" PRIMARY KEY ("historia_id","categoria")
);

-- CreateTable
CREATE TABLE "historia_bloques" (
    "id" UUID NOT NULL,
    "historia_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "texto1" TEXT,
    "texto2" TEXT,
    "texto3" TEXT,
    "texto4" TEXT,
    "image_url" TEXT NOT NULL,
    "mobile_image_url" TEXT,

    CONSTRAINT "historia_bloques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historia_relacionadas" (
    "historia_a_id" UUID NOT NULL,
    "historia_b_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historia_relacionadas_pkey" PRIMARY KEY ("historia_a_id","historia_b_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "historias_slug_key" ON "historias"("slug");

-- CreateIndex
CREATE INDEX "historia_bloques_historia_id_orden_idx" ON "historia_bloques"("historia_id", "orden");

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_destacada_historia_id_fkey" FOREIGN KEY ("destacada_historia_id") REFERENCES "historias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historia_categorias" ADD CONSTRAINT "historia_categorias_historia_id_fkey" FOREIGN KEY ("historia_id") REFERENCES "historias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historia_bloques" ADD CONSTRAINT "historia_bloques_historia_id_fkey" FOREIGN KEY ("historia_id") REFERENCES "historias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historia_relacionadas" ADD CONSTRAINT "historia_relacionadas_historia_a_id_fkey" FOREIGN KEY ("historia_a_id") REFERENCES "historias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historia_relacionadas" ADD CONSTRAINT "historia_relacionadas_historia_b_id_fkey" FOREIGN KEY ("historia_b_id") REFERENCES "historias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
