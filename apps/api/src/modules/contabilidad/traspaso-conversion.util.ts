import { BadRequestException } from "@nestjs/common";
import { MonedaCartera } from "@app/database";

type FormulaTraspaso = "MULTIPLICA" | "FIJO_1A1";

/**
 * Pares de moneda habilitados para traspaso directo. `a`/`b` fijan una convención: transferir de
 * `a` a `b` multiplica el monto por el tipo de cambio (tipoCambio = cuántos `b` vale 1 `a`);
 * transferir de `b` a `a` divide por ese mismo tipo de cambio. `a` es siempre la moneda "de
 * referencia" tal como se cotiza en la calle (ej. "el dólar está a 14 bolivianos" → a=USDT/USD,
 * b=BS, tipoCambio=14), no necesariamente la primera moneda alfabética. USDT↔USD es 1:1 fijo (ambos
 * referencian el dólar), sin pedir tipo de cambio. Cualquier par no listado (y que no sea la misma
 * moneda) no permite traspaso directo.
 */
const PARES_TRASPASO: { a: MonedaCartera; b: MonedaCartera; formula: FormulaTraspaso }[] = [
  { a: "USDT", b: "BS", formula: "MULTIPLICA" },
  { a: "USD", b: "BS", formula: "MULTIPLICA" },
  { a: "BS", b: "CLP", formula: "MULTIPLICA" },
  { a: "USDT", b: "GS", formula: "MULTIPLICA" },
  { a: "USDT", b: "CLP", formula: "MULTIPLICA" },
  { a: "USDT", b: "USD", formula: "FIJO_1A1" },
];

function buscarPar(m1: MonedaCartera, m2: MonedaCartera) {
  return PARES_TRASPASO.find((p) => (p.a === m1 && p.b === m2) || (p.a === m2 && p.b === m1));
}

export function monedaPermiteTraspaso(origen: MonedaCartera, destino: MonedaCartera): boolean {
  return origen === destino || Boolean(buscarPar(origen, destino));
}

/**
 * Calcula montoDestino y el tipoCambio efectivo, validando que el par de monedas esté habilitado
 * y que se haya provisto tipoCambio cuando corresponde. Lanza BadRequestException si algo no cierra.
 */
export function calcularConversionTraspaso(
  origenMoneda: MonedaCartera,
  destinoMoneda: MonedaCartera,
  montoOrigen: number,
  tipoCambioInput: number | undefined,
): { tipoCambio: number; montoDestino: number } {
  if (origenMoneda === destinoMoneda) {
    return { tipoCambio: 1, montoDestino: montoOrigen };
  }

  const par = buscarPar(origenMoneda, destinoMoneda);
  if (!par) {
    throw new BadRequestException(`No se permite traspaso directo entre ${origenMoneda} y ${destinoMoneda}.`);
  }

  if (par.formula === "FIJO_1A1") {
    return { tipoCambio: 1, montoDestino: montoOrigen };
  }

  if (!tipoCambioInput) {
    throw new BadRequestException("tipoCambio es obligatorio para este par de monedas.");
  }

  const montoDestino = origenMoneda === par.a ? montoOrigen * tipoCambioInput : montoOrigen / tipoCambioInput;
  return { tipoCambio: tipoCambioInput, montoDestino };
}
