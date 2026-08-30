import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Profile, Strategy, VerifyCallback } from "passport-google-oauth20";
import { ClienteAuthService } from "../cliente-auth.service";

/** Sin session() en main.ts la app ya es stateless — Nest no necesita nada extra para que este
 * strategy funcione sin sesiones de servidor.
 *
 * OAuth2Strategy (la base de passport-google-oauth20) exige un clientID/clientSecret no vacíos en
 * SU CONSTRUCTOR — pasar "" ahí tira un TypeError que crashea el boot de toda la app, no solo esta
 * ruta (Nest instancia todos los providers de un módulo de entrada, no perezoso). Sin credenciales
 * reales todavía (ver GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET en .env) se usa un placeholder no vacío
 * para que el resto de la API arranque igual — pegarle a /cliente-auth/google en ese estado redirige
 * a Google, que rechaza el client_id con su propio error, en vez de tumbar el proceso entero. */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(private readonly clienteAuth: ClienteAuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || "missing-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "missing-google-client-secret",
      callbackURL: process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:4100/api/cliente-auth/google/callback",
      scope: ["email", "profile"],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new UnauthorizedException("No se pudo obtener el email de la cuenta de Google."), false);
    }
    const cliente = await this.clienteAuth.findOrCreateFromGoogle({
      googleId: profile.id,
      email: email.toLowerCase(),
      nombre: profile.displayName || email,
    });
    done(null, cliente);
  }
}
