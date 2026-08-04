import { randomInt } from "node:crypto";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LENGTH = 7;

/** Código alfanumérico de 7 caracteres, generado por el sistema (no lo escribe el usuario). */
export function generateEntityCode(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += CHARSET[randomInt(CHARSET.length)];
  }
  return code;
}

/** Genera un código de 7 caracteres y reintenta si ya existe (chequeado con `exists`). */
export async function generateUniqueEntityCode(exists: (code: string) => Promise<boolean>): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateEntityCode();
    if (!(await exists(code))) return code;
  }
  throw new Error("No se pudo generar un código único, reintentá de nuevo.");
}
