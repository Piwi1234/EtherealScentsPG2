import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Rol } from "@app/database";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthenticatedUser } from "../strategies/jwt.strategy";

/** Lee la metadata de @Roles(...) y la compara contra request.user.rol (seteado por JwtAuthGuard). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user || !requiredRoles.includes(user.rol)) {
      throw new ForbiddenException("Acceso denegado");
    }

    return true;
  }
}
