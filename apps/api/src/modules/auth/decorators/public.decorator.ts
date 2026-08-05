import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marca una ruta como exenta de JwtAuthGuard (ej. login, refresh-token). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
