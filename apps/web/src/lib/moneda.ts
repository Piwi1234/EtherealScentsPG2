import type { MonedaCartera } from "./types";

export const MONEDA_PREFIX: Record<MonedaCartera, string> = {
  BS: "Bs",
  USDT: "USDT",
  GS: "Gs",
  CLP: "CLP",
  USD: "USD",
};

export function formatMonto(value: string | number, moneda: MonedaCartera): string {
  return `${MONEDA_PREFIX[moneda]} ${Number(value).toFixed(2)}`;
}

/**
 * Pares de moneda habilitados para traspaso directo — debe reflejar exactamente
 * traspaso-conversion.util.ts del backend (que es quien manda en el cálculo real). `a`/`b` fijan la
 * convención: ir de `a` a `b` multiplica por el tipo de cambio, de `b` a `a` divide. `a` es siempre
 * la moneda "de referencia" tal como se cotiza en la calle (ej. "el dólar está a 14 bolivianos" →
 * a=USDT/USD, b=BS). USDT↔USD es 1:1 fijo, sin pedir tipo de cambio. Se usa acá solo para decidir
 * qué mostrar en el formulario.
 */
type FormulaTraspaso = "MULTIPLICA" | "FIJO_1A1";

const PARES_TRASPASO: { a: MonedaCartera; b: MonedaCartera; formula: FormulaTraspaso }[] = [
  { a: "USDT", b: "BS", formula: "MULTIPLICA" },
  { a: "USD", b: "BS", formula: "MULTIPLICA" },
  { a: "BS", b: "CLP", formula: "MULTIPLICA" },
  { a: "USDT", b: "GS", formula: "MULTIPLICA" },
  { a: "USDT", b: "CLP", formula: "MULTIPLICA" },
  { a: "USDT", b: "USD", formula: "FIJO_1A1" },
];

function buscarParTraspaso(m1: MonedaCartera, m2: MonedaCartera) {
  return PARES_TRASPASO.find((p) => (p.a === m1 && p.b === m2) || (p.a === m2 && p.b === m1));
}

export function monedaPermiteTraspaso(origen: MonedaCartera, destino: MonedaCartera): boolean {
  return origen === destino || Boolean(buscarParTraspaso(origen, destino));
}

export function requiereTipoCambioTraspaso(origen: MonedaCartera, destino: MonedaCartera): boolean {
  if (origen === destino) return false;
  return buscarParTraspaso(origen, destino)?.formula === "MULTIPLICA";
}

/** "1 Bs = ? USDT" — la convención de tipo de cambio de este par, sin importar la dirección del traspaso. */
export function labelTipoCambioTraspaso(origen: MonedaCartera, destino: MonedaCartera): string {
  const par = buscarParTraspaso(origen, destino);
  if (!par) return "";
  return `1 ${MONEDA_PREFIX[par.a]} = ? ${MONEDA_PREFIX[par.b]}`;
}
