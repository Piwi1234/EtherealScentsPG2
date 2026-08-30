import { ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { Rol } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { sha256 } from "../../common/hash.util";
import type { AccessTokenPayload } from "./strategies/jwt.strategy";
import { parseDurationMs, parseDurationSeconds } from "./duration.util";

@Injectable()
export class AuthService {
  private readonly accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? "30m";
  private readonly refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "7d";
  private readonly refreshSecret = process.env.JWT_REFRESH_SECRET ?? "development-refresh-secret";

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private async issueTokens(usuario: { id: string; rol: Rol }) {
    const payload: AccessTokenPayload = { sub: usuario.id, rol: usuario.rol, scope: "gestion" };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: parseDurationSeconds(this.accessExpiresIn) });

    const refreshToken = await this.jwt.signAsync(
      { sub: usuario.id },
      { secret: this.refreshSecret, expiresIn: parseDurationSeconds(this.refreshExpiresIn) },
    );
    await this.prisma.refreshToken.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: sha256(refreshToken),
        expiraEn: new Date(Date.now() + parseDurationMs(this.refreshExpiresIn)),
      },
    });

    return { accessToken, refreshToken };
  }

  async login(email: string, password: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
    const passwordIsValid = usuario ? await compare(password, usuario.passwordHash) : false;

    // Mensaje genérico: nunca revelar si falló el email o la contraseña.
    if (!usuario || !passwordIsValid || !usuario.activo) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    const [tokens] = await Promise.all([
      this.issueTokens(usuario),
      this.prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoLogin: new Date() } }),
    ]);

    return {
      ...tokens,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    };
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = sha256(refreshToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: { usuarioId: payload.sub, tokenHash, revocado: false },
    });
    if (!stored || stored.expiraEn < new Date()) {
      throw new UnauthorizedException("Refresh token inválido o expirado");
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id: payload.sub } });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException("Refresh token inválido o expirado");
    }

    // Rotación obligatoria: se revoca el token usado y se emite un par nuevo.
    const [tokens] = await Promise.all([
      this.issueTokens(usuario),
      this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revocado: true } }),
    ]);

    return tokens;
  }

  async logout(usuarioId: string, refreshToken: string) {
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { usuarioId, tokenHash, revocado: false },
    });
    if (!stored) {
      throw new ForbiddenException("Refresh token inválido");
    }
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revocado: true } });
  }

  private async verifyRefreshToken(refreshToken: string): Promise<{ sub: string }> {
    try {
      return await this.jwt.verifyAsync<{ sub: string }>(refreshToken, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException("Refresh token inválido o expirado");
    }
  }
}
