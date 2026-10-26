-- Costos reales (por unidad) con los que se recibió cada parte de un envío: reemplazan a los estimados de la compra
-- al fijar el costo del lote. El precio de compra no se edita.
ALTER TABLE "envio_recepcion_items" ADD COLUMN "costo_envio" DECIMAL(12,2);
ALTER TABLE "envio_recepcion_items" ADD COLUMN "costo_seguridad" DECIMAL(12,2);
ALTER TABLE "envio_recepcion_items" ADD COLUMN "costo_logistica" DECIMAL(12,2);
