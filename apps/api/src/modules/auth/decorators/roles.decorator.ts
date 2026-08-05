import { SetMetadata } from "@nestjs/common";
import { Rol } from "@app/database";

export const ROLES_KEY = "roles";

/** Restringe una ruta a uno o más roles (ej. @Roles(Rol.ADMIN)). Requiere RolesGuard. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
