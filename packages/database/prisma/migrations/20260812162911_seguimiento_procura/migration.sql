-- Reemplaza el viejo seguimiento de 4 pasos (Pendiente/Comprado/Enviado/Recibido, log por línea) por
-- un estado actual de 2 valores (Pendiente/Enviado) directamente en la fila de Procura pendiente.
-- Sin datos que migrar: proforma_detalle_seguimiento está vacía en todos los ambientes.

CREATE TYPE "estado_seguimiento_procura" AS ENUM ('PENDIENTE', 'ENVIADO');

ALTER TABLE "proforma_detalle_asignaciones"
  ADD COLUMN "estado_seguimiento" "estado_seguimiento_procura" NOT NULL DEFAULT 'PENDIENTE';

DROP TABLE "proforma_detalle_seguimiento";

DROP TYPE "estado_seguimiento";
