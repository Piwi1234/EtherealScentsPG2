-- telefonos pasa de texto libre (un número por línea) a un array de números individuales — cada
-- uno se muestra en el footer con su propio link a wa.me. La conversión separa el texto existente
-- por salto de línea, recorta espacios y descarta líneas vacías, así no se pierden los números ya
-- cargados. Postgres no permite una subconsulta directamente en el USING de un ALTER COLUMN TYPE,
-- así que se hace en 2 pasos: columna nueva + UPDATE (que sí admite subconsulta), en vez de
-- transformar la columna existente en el lugar.
ALTER TABLE "system_settings" ADD COLUMN "telefonos_new" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "system_settings"
SET "telefonos_new" = (
  SELECT COALESCE(array_agg(trim(elem)), ARRAY[]::TEXT[])
  FROM unnest(string_to_array(COALESCE("telefonos", ''), E'\n')) AS elem
  WHERE trim(elem) <> ''
);

ALTER TABLE "system_settings" DROP COLUMN "telefonos";
ALTER TABLE "system_settings" RENAME COLUMN "telefonos_new" TO "telefonos";

-- Logo de WhatsApp (Configuración → Contacto) — uno solo, compartido por todos los números.
ALTER TABLE "system_settings" ADD COLUMN "whatsapp_logo_url" TEXT;
