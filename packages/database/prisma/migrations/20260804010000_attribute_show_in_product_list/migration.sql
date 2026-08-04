-- Si el atributo se muestra como columna extra en la tabla de Productos del panel.
ALTER TABLE "attributes" ADD COLUMN "show_in_product_list" BOOLEAN NOT NULL DEFAULT false;
