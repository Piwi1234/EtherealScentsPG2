-- Fase 2 de las búsquedas sin importar acentos (ver 20261029100000_busqueda_sin_tildes): clientes, proveedores e historias.
-- Misma tabla de caracteres que apps/api/src/common/busqueda.ts.
ALTER TABLE "clientes" ADD COLUMN "nombre_search" TEXT GENERATED ALWAYS AS (
  lower(translate("nombre", 'ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑÇ', 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuñç'))
) STORED;

ALTER TABLE "proveedores" ADD COLUMN "nombre_search" TEXT GENERATED ALWAYS AS (
  lower(translate("nombre", 'ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑÇ', 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuñç'))
) STORED;

ALTER TABLE "historias" ADD COLUMN "titulo_search" TEXT GENERATED ALWAYS AS (
  lower(translate("titulo", 'ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑÇ', 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuñç'))
) STORED;
