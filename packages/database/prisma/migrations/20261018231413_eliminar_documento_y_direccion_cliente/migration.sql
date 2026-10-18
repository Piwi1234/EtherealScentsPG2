-- Se elimina el campo de documento (tipo + número) y dirección de Cliente, a pedido: no se
-- usan en ningún flujo de negocio (ver proforma-pdf.service.ts, que ya nunca mostró dirección).
ALTER TABLE "clientes" DROP COLUMN "tipo_documento";
ALTER TABLE "clientes" DROP COLUMN "numero_documento";
ALTER TABLE "clientes" DROP COLUMN "direccion";

DROP TYPE "tipo_documento";
