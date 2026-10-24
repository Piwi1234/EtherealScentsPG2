-- Almacén por defecto: se preselecciona cada vez que el sistema pide un almacén.
ALTER TABLE "almacenes" ADD COLUMN "predeterminado" BOOLEAN NOT NULL DEFAULT false;

-- A lo sumo uno predeterminado (índice único parcial: Prisma no lo expresa en el schema).
CREATE UNIQUE INDEX "almacenes_predeterminado_unico" ON "almacenes" ("predeterminado") WHERE "predeterminado";
