-- Pedido a propósito: unidades de una venta aprobada que el administrador pasa de stock a pedido (Seguimiento) y que las
-- reservas automáticas no deben volver a tomar del stock.
ALTER TABLE "proforma_detalle_asignaciones" ADD COLUMN "solo_pedido" BOOLEAN NOT NULL DEFAULT false;
