import { randomInt } from "node:crypto";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LENGTH = 7;

/** Código de producto alfanumérico de 7 caracteres, generado por el sistema (no lo escribe el usuario). */
export function generateProductCode(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += CHARSET[randomInt(CHARSET.length)];
  }
  return code;
}
