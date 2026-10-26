-- Recojos: cada vez que se retira mercadería de un proveedor se registra qué se recogió de cada línea de la
-- compra (parcial o completo). Lo que falta queda "por recoger" y se completa en otro recojo.
CREATE TABLE "recojos" (
    "id" UUID NOT NULL,
    "compra_id" UUID NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" TEXT,
    "creado_por_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recojos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recojos_compra_id_idx" ON "recojos"("compra_id");

CREATE TABLE "recojo_lineas" (
    "id" UUID NOT NULL,
    "recojo_id" UUID NOT NULL,
    "compra_detalle_id" UUID NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "recojo_lineas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "recojo_lineas_cantidad_check" CHECK ("cantidad" > 0)
);

CREATE INDEX "recojo_lineas_recojo_id_idx" ON "recojo_lineas"("recojo_id");
CREATE INDEX "recojo_lineas_compra_detalle_id_idx" ON "recojo_lineas"("compra_detalle_id");

ALTER TABLE "recojos"
  ADD CONSTRAINT "recojos_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "proformas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recojos"
  ADD CONSTRAINT "recojos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recojo_lineas"
  ADD CONSTRAINT "recojo_lineas_recojo_id_fkey" FOREIGN KEY ("recojo_id") REFERENCES "recojos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recojo_lineas"
  ADD CONSTRAINT "recojo_lineas_compra_detalle_id_fkey" FOREIGN KEY ("compra_detalle_id") REFERENCES "proforma_detalles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
