-- Probadores -> decants: los ml que quedan en un probador se vierten a la variante Decants (ML) del mismo producto.

ALTER TYPE "tipo_movimiento_probador" ADD VALUE 'A_DECANT';
ALTER TYPE "tipo_movimiento_decant" ADD VALUE 'DESDE_PROBADOR';

ALTER TABLE "movimientos_probador" ADD COLUMN "decant_movimiento_id" UUID;
ALTER TABLE "movimientos_probador" ADD COLUMN "revertido_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "movimientos_probador_decant_movimiento_id_key" ON "movimientos_probador"("decant_movimiento_id");

ALTER TABLE "movimientos_probador" ADD CONSTRAINT "movimientos_probador_decant_movimiento_id_fkey" FOREIGN KEY ("decant_movimiento_id") REFERENCES "movimientos_decant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
