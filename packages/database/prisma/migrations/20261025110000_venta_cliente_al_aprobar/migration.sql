-- El cliente de una venta se puede elegir después de crear el borrador; sigue siendo obligatorio
-- para cualquier venta que ya no esté en BORRADOR (la API lo valida además al aprobar).
ALTER TABLE "proformas" DROP CONSTRAINT "proformas_venta_requiere_cliente_check";
ALTER TABLE "proformas" ADD CONSTRAINT "proformas_venta_requiere_cliente_check"
  CHECK ("tipo" != 'VENTA' OR "estado" = 'BORRADOR' OR "cliente_id" IS NOT NULL);
