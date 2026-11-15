-- Campañas de descuento masivo (Black Friday, etc.) con inicio y fin, y la vitrina de la tienda.

CREATE TYPE "estado_campana" AS ENUM ('BORRADOR', 'PROGRAMADA', 'ACTIVA', 'TERMINADA', 'REVERTIDA');
CREATE TYPE "tipo_descuento_campana" AS ENUM ('NINGUNO', 'PORCENTAJE', 'MONTO');

CREATE TABLE "campanas" (
  "id" UUID NOT NULL,
  "nombre" TEXT NOT NULL,
  "estado" "estado_campana" NOT NULL DEFAULT 'BORRADOR',
  "inicio" TIMESTAMP(3) NOT NULL,
  "fin" TIMESTAMP(3) NOT NULL,
  "tipo_descuento" "tipo_descuento_campana" NOT NULL DEFAULT 'NINGUNO',
  "valor" DECIMAL(12,2),
  "alcance" JSONB NOT NULL,
  "opciones" JSONB NOT NULL,
  "creado_por_id" UUID NOT NULL,
  "aplicada_at" TIMESTAMP(3),
  "terminada_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "campanas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campanas_fechas_check" CHECK ("fin" > "inicio")
);

CREATE INDEX "campanas_estado_idx" ON "campanas"("estado");

CREATE TABLE "campana_items" (
  "id" UUID NOT NULL,
  "campana_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "variante_id" UUID,
  "descuento_anterior" DECIMAL(12,2) NOT NULL,
  "descuento_nuevo" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "campana_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "campana_items_campana_id_idx" ON "campana_items"("campana_id");

ALTER TABLE "campana_items" ADD CONSTRAINT "campana_items_campana_id_fkey" FOREIGN KEY ("campana_id") REFERENCES "campanas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
