import { Prisma } from "@app/database";

// Vocales con tilde, grave, circunfleja, diéresis, tilde portuguesa y anillo (y sus mayúsculas) pasan a la vocal simple; la
// Ñ y la Ç solo pasan a minúscula: "ñ" sigue siendo "ñ" ("piña" no se confunde con "pina"). Es la MISMA tabla que usan las
// columnas calculadas `name_search` (migración 20261029100000_busqueda_sin_tildes): si cambia una, cambia la otra.
const DESDE = "ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑÇ";
const HASTA = "AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuñç";

/** Minúsculas y vocales sin acento ("Café" → "cafe", "Hermès" → "hermes", "Piña" → "piña"), para comparar búsquedas. */
export function normalizarBusqueda(texto: string): string {
  let salida = "";
  for (const ch of texto.normalize("NFC")) {
    const i = DESDE.indexOf(ch);
    salida += i >= 0 ? HASTA[i] : ch;
  }
  return salida.toLowerCase();
}

/** Las palabras de una búsqueda, ya normalizadas (cada una tiene que aparecer en el producto). */
export function palabrasBusqueda(texto: string | undefined | null): string[] {
  return normalizarBusqueda((texto ?? "").trim()).split(/\s+/).filter(Boolean);
}

/**
 * Filtro de productos por palabras: cada palabra tiene que estar en el nombre, el código o la marca, sin importar
 * mayúsculas ni acentos. El nombre y la marca se comparan contra sus columnas normalizadas.
 */
export function filtroProductoPorPalabras(palabras: string[], opciones: { codigo?: boolean } = {}): Prisma.ProductWhereInput[] {
  const { codigo = true } = opciones;
  return palabras.map((word) => ({
    OR: [
      { nameSearch: { contains: word } },
      ...(codigo ? [{ productCode: { contains: word, mode: "insensitive" as const } }] : []),
      { brand: { nameSearch: { contains: word } } },
    ],
  }));
}
