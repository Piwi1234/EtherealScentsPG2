import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

export type ClienteAccessTokenPayload = {
  sub: string;
  scope: string;
};

export type AuthenticatedCliente = {
  id: string;
};

/** Mismo mecanismo que JwtStrategy (auth interno), pero con secreto y scope propios ("cliente" en vez
 * de "gestion") — así un token de cliente nunca valida acá con el de gestión, ni al revés, aunque
 * compartieran secreto por error. */
@Injectable()
export class ClienteJwtStrategy extends PassportStrategy(Strategy, "jwt-cliente") {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.CLIENTE_JWT_ACCESS_SECRET ?? "development-cliente-access-secret",
    });
  }

  validate(payload: ClienteAccessTokenPayload): AuthenticatedCliente {
    if (payload.scope !== "cliente") {
      throw new UnauthorizedException("Token inválido");
    }
    return { id: payload.sub };
  }
}
