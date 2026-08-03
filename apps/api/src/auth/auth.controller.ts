import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { User } from "./decorators/user.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(@Body() body: { email?: string; password?: string }) {
    return this.auth.login(body.email ?? "", body.password ?? "");
  }

  @Post("register")
  register(@Body() body: { email?: string; password?: string; firstName?: string; lastName?: string }) {
    return this.auth.register(body.email ?? "", body.password ?? "", body.firstName ?? "", body.lastName ?? "");
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@User("sub") userId: string) {
    return this.auth.getProfile(userId);
  }
}
