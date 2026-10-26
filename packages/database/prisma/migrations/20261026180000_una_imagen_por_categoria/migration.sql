-- "Explora por categoría" usa UNA imagen por categoría raíz (antes, un carrusel con títulos, link e imagen mobile).
-- Se conserva la primera imagen de cada categoría y se retiran el resto y los campos que ya no se usan.
DELETE FROM "carousel_images" c
WHERE c."kind" = 'FEATURE'
  AND c."id" <> (
    SELECT c2."id" FROM "carousel_images" c2
    WHERE c2."category_id" = c."category_id" AND c2."kind" = 'FEATURE'
    ORDER BY c2."orden" ASC, c2."created_at" ASC
    LIMIT 1
  );

UPDATE "carousel_images" SET "url" = NULL, "mobile_image_url" = NULL WHERE "kind" = 'FEATURE';

ALTER TABLE "carousel_images" DROP COLUMN "titulo_1";
ALTER TABLE "carousel_images" DROP COLUMN "titulo_2";
