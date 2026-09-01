-- CreateTable
CREATE TABLE "cliente_password_reset_tokens" (
    "id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cliente_password_reset_tokens" ADD CONSTRAINT "cliente_password_reset_tokens_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
