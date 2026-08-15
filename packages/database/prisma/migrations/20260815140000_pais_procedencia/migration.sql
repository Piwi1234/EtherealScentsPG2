-- Rename: CiudadProcedencia -> PaisProcedencia (mismo dato, nombre más correcto: "de dónde viene la
-- mercadería" ya se guarda como país, ej. "Estados Unidos", "Chile"). Renombres puros, no se pierde
-- ningún dato.
ALTER TABLE "ciudades_procedencia" RENAME TO "paises_procedencia";
ALTER TABLE "paises_procedencia" RENAME CONSTRAINT "ciudades_procedencia_pkey" TO "paises_procedencia_pkey";
ALTER INDEX "ciudades_procedencia_nombre_key" RENAME TO "paises_procedencia_nombre_key";

ALTER TABLE "proformas" RENAME COLUMN "ciudad_procedencia_id" TO "pais_procedencia_id";
ALTER TABLE "proformas" RENAME CONSTRAINT "proformas_ciudad_procedencia_id_fkey" TO "proformas_pais_procedencia_id_fkey";
