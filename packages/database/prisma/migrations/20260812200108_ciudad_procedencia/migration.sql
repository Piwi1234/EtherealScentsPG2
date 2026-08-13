CREATE TABLE "ciudades_procedencia" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ciudades_procedencia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ciudades_procedencia_nombre_key" ON "ciudades_procedencia"("nombre");
