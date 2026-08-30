import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ClienteAuthController } from "./cliente-auth.controller";
import { ClienteAuthService } from "./cliente-auth.service";
import { ClienteJwtStrategy } from "./strategies/cliente-jwt.strategy";
import { GoogleStrategy } from "./strategies/google.strategy";
import { parseDurationSeconds } from "../auth/duration.util";

@Module({
  imports: [
    PassportModule,
    // JwtService propio, con el secreto de cliente — a propósito NO se reusa el que exporta el
    // AuthModule global (ese está atado a JWT_ACCESS_SECRET, el de gestión). ThrottlerModule ya
    // quedó registrado globalmente por AuthModule (@Global()), no hace falta repetirlo acá.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.CLIENTE_JWT_ACCESS_SECRET ?? "development-cliente-access-secret",
        signOptions: { expiresIn: parseDurationSeconds(process.env.CLIENTE_JWT_ACCESS_EXPIRES_IN ?? "30m") },
      }),
    }),
  ],
  controllers: [ClienteAuthController],
  providers: [ClienteAuthService, ClienteJwtStrategy, GoogleStrategy],
})
export class ClienteAuthModule {}
