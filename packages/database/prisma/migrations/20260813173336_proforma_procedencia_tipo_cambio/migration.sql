ALTER TABLE "proformas" ADD COLUMN "ciudad_procedencia_id" UUID;
ALTER TABLE "proformas" ADD COLUMN "tipo_cambio_prof" DECIMAL(12,4);

ALTER TABLE "proformas" ADD CONSTRAINT "proformas_ciudad_procedencia_id_fkey" FOREIGN KEY ("ciudad_procedencia_id") REFERENCES "ciudades_procedencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
