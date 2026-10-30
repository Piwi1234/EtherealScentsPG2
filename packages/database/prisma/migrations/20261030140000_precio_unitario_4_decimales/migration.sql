-- Las líneas de venta de decants (ml) guardan precio y descuento POR ML: con 2 decimales se perdían centavos al volver a
-- multiplicar (ej. 100 Bs / 30 ml = 3.3333 por ml). Ampliar a 4 decimales es sin pérdida para lo ya guardado.
ALTER TABLE "proforma_detalles" ALTER COLUMN "precio_unitario" TYPE DECIMAL(12,4);
ALTER TABLE "proforma_detalles" ALTER COLUMN "descuento_unitario" TYPE DECIMAL(12,4);
