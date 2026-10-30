-- Búsquedas sin importar acentos: columnas calculadas (la base las mantiene sola) con el texto en minúsculas y las vocales
-- sin acento. La Ñ y la Ç solo pasan a minúscula. La tabla de caracteres es la misma de apps/api/src/common/busqueda.ts.
ALTER TABLE "products" ADD COLUMN "name_search" TEXT GENERATED ALWAYS AS (
  lower(translate("name", 'ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑÇ', 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuñç'))
) STORED;

ALTER TABLE "brands" ADD COLUMN "name_search" TEXT GENERATED ALWAYS AS (
  lower(translate("name", 'ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑÇ', 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuñç'))
) STORED;
