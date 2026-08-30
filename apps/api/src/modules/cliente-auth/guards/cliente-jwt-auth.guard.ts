import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/** Guard puntual (NO global, a diferencia de JwtAuthGuard) — se aplica con @UseGuards() solo en las
 * rutas de ClienteAuthController que necesitan un cliente logueado (ej. logout). Valida contra el
 * strategy "jwt-cliente" (ver ClienteJwtStrategy). */
@Injectable()
export class ClienteJwtAuthGuard extends AuthGuard("jwt-cliente") {}
