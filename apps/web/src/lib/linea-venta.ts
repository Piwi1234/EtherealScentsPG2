// Decants: una línea de venta con presentación guarda la cantidad en ml y el precio por ml (así el stock y las reservas
// siguen contando ml), pero a la gente se le muestra por presentación: "1 decant de 5 ml × Bs 100". Estas funciones hacen
// esa conversión en un solo lugar. En líneas sin presentación el factor es 1 y todo queda igual.

type ConPresentacion = { presentacionVenta?: { cantidadMl: number } | null };

/** ml por presentación (1 si la línea no es un decant). */
export function mlPorPresentacion(d: ConPresentacion): number {
  return d.presentacionVenta?.cantidadMl ?? 1;
}

/** Unidades que se ven en la nota: presentaciones en un decant, piezas en lo demás. */
export function unidadesLinea(d: ConPresentacion & { cantidad: number }): number {
  return d.cantidad / mlPorPresentacion(d);
}

/** Precio (o descuento) por unidad visible: por presentación en un decant. Redondeado a centavos. */
export function porUnidadLinea(d: ConPresentacion, valorPorMl: string | number | null | undefined): number {
  return Math.round(Number(valorPorMl ?? 0) * mlPorPresentacion(d) * 100) / 100;
}
