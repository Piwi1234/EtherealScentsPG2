-- Atributos SELECT normales (variantMode NONE) pueden permitir elegir varias opciones de la lista
-- compartida de la categoría (ej. Acordes de un perfume: 1 producto puede tener 2+), para poder
-- filtrar por ellas más adelante. Distinto de MULTI_VALUE (valores propios por producto).
ALTER TABLE "attributes" ADD COLUMN "allow_multiple" BOOLEAN NOT NULL DEFAULT false;

-- Color configurable por opción (botón coloreado al elegirla en el formulario de producto).
ALTER TABLE "attribute_options" ADD COLUMN "color" TEXT;
