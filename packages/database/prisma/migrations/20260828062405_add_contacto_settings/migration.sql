-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "telefonos" TEXT;

-- CreateTable
CREATE TABLE "redes_sociales" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redes_sociales_pkey" PRIMARY KEY ("id")
);
