import { createHash } from "node:crypto";

/** Los refresh tokens nunca se guardan en texto plano: solo su hash (determinístico, para poder
 * buscarlos por igualdad exacta al validarlos). Usado tanto por AuthService (Usuario) como por
 * ClienteAuthService (Cliente). */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
