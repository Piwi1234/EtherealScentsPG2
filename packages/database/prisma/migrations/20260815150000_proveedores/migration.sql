-- CreateTable
CREATE TABLE "proveedores" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "pais_procedencia_id" UUID,
    "nota" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_pais_procedencia_id_fkey" FOREIGN KEY ("pais_procedencia_id") REFERENCES "paises_procedencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
