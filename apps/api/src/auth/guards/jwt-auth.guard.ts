import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Authorization token is required");
    }

    const token = authorization.slice(7);
    try {
      const payload = await this.jwt.verifyAsync(token);
      (request as any).user = payload as Record<string, unknown>;
      return true;
    } catch {
      throw new UnauthorizedException("Token inválido");
    }
  }
}
