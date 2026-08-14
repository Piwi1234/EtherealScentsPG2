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
