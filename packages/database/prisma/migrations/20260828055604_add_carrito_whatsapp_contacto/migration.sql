-- CreateTable
CREATE TABLE "carrito_whatsapp_contactos" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "descripcion" TEXT,
    "imagen_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrito_whatsapp_contactos_pkey" PRIMARY KEY ("id")
);
