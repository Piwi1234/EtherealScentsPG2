import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { parseDurationSeconds } from "./duration.util";

@Global()
@Module({
  imports: [
    PassportModule,
    // registerAsync (no register): el factory se evalúa al instanciar el módulo (ya con dotenv
    // cargado por ConfigModule), no al importar el archivo — con .register() estático el secret se
    // leía de process.env ANTES de que ConfigModule corriera, quedando siempre en el valor default.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_ACCESS_SECRET ?? "development-access-secret",
        signOptions: { expiresIn: parseDurationSeconds(process.env.JWT_ACCESS_EXPIRES_IN ?? "30m") },
      }),
    }),
    // Límite específico de /auth/login (ver @Throttle en AuthController); no se aplica globalmente.
    ThrottlerModule.forRoot([{ name: "default", ttl: 15 * 60 * 1000, limit: 5 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Guards globales: JwtAuthGuard primero (setea request.user), RolesGuard después (lo consume).
    // Las rutas @Public() (login, refresh-token) los saltean.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
