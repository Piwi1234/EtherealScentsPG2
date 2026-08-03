import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? "development-secret",
      signOptions: { expiresIn: "8h" },
    }),
  ],
  controllers: [AuthController],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
