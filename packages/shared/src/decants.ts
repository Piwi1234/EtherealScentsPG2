/**
 * Tamaños (en ml) en que se vende un decant. Lista fija: la usan la API (valida al crear una presentación) y la web (botones del
 * modal de presentaciones y, más adelante, los filtros públicos por tamaño). Para añadir un tamaño basta con agregarlo aquí, en orden.
 */
export const TAMANOS_DECANT_ML = [2, 3, 5, 10, 15, 30, 50] as const;

export type TamanoDecantMl = (typeof TAMANOS_DECANT_ML)[number];
