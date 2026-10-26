-- Nuevo origen de asignación: reserva contra stock que viaja en un envío ya despachado. Va en su
-- propia migración porque Postgres no deja USAR un valor de enum recién agregado dentro de la misma
-- transacción (la siguiente migración lo usa en un CHECK).
ALTER TYPE "origen_asignacion" ADD VALUE 'EN_TRANSITO';
