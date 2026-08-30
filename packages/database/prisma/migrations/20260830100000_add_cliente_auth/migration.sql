-- AlterTable
ALTER TABLE "clientes" ALTER COLUMN "tipo_documento" DROP NOT NULL,
ALTER COLUMN "numero_documento" DROP NOT NULL,
ADD COLUMN     "password_hash" TEXT,
ADD COLUMN     "google_id" TEXT;

-- CreateTable
CREATE TABLE "cliente_refresh_tokens" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "revocado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_google_id_key" ON "clientes"("google_id");

-- AddForeignKey
ALTER TABLE "cliente_refresh_tokens" ADD CONSTRAINT "cliente_refresh_tokens_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
