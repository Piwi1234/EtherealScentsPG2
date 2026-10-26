-- Cuánto stock "en tránsito" aportó cada línea de compra al despachar su envío. Se guarda para restar
-- exactamente lo mismo al anular el envío o recibirlo, aunque después cambien los vínculos de la línea
-- con notas de venta (una línea "Pedido de cliente" aporta solo la parte que no está ligada a una nota).
ALTER TABLE "proforma_detalles" ADD COLUMN "en_transito_contado" INTEGER NOT NULL DEFAULT 0;

-- Envíos ya despachados: sus líneas "para stock" aportaron su cantidad completa.
UPDATE "proforma_detalles" d
SET "en_transito_contado" = d."cantidad"
FROM "proformas" p
JOIN "envios" e ON e."id" = p."envio_id"
WHERE d."proforma_id" = p."id"
  AND e."estado" = 'EN_TRANSITO'
  AND d."destino" = 'STOCK';
