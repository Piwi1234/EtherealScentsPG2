-- Agrega el estado intermedio COMPRADO al seguimiento de Procura: PENDIENTE -> COMPRADO -> ENVIADO.
ALTER TYPE "estado_seguimiento_procura" ADD VALUE 'COMPRADO' BEFORE 'ENVIADO';
