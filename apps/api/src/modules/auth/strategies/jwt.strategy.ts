import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Rol } from "@app/database";

export type AccessTokenPayload = {
  sub: string;
  rol: Rol;
  scope: string;
};

export type AuthenticatedUser = {
  id: string;
  rol: Rol;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? "development-access-secret",
    });
  }

  /** Passport inyecta el resultado como request.user. Solo se llega acá con firma/expiración válidas. */
  validate(payload: AccessTokenPayload): AuthenticatedUser {
    if (payload.scope !== "gestion") {
      throw new UnauthorizedException("Token inválido");
    }
    return { id: payload.sub, rol: payload.rol };
  }
}
