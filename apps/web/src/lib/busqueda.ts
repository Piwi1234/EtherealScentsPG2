// Misma tabla que apps/api/src/common/busqueda.ts: vocales con cualquier acento pasan a la vocal simple; la Ñ y la Ç solo
// pasan a minúscula ("piña" no se confunde con "pina").
const DESDE = "ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕóòôöõÚÙÛÜúùûüÑÇ";
const HASTA = "AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuñç";

/** Minúsculas y vocales sin acento ("Café" → "cafe", "Hermès" → "hermes"), para filtrar listas mientras se escribe. */
export function normalizarBusqueda(texto: string): string {
  let salida = "";
  for (const ch of texto.normalize("NFC")) {
    const i = DESDE.indexOf(ch);
    salida += i >= 0 ? HASTA[i] : ch;
  }
  return salida.toLowerCase();
}

/** true si `texto` contiene `busqueda`, ignorando mayúsculas y acentos. */
export function contieneBusqueda(texto: string | null | undefined, busqueda: string): boolean {
  return normalizarBusqueda(texto ?? "").includes(normalizarBusqueda(busqueda.trim()));
}
