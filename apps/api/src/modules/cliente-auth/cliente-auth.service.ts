import { randomBytes } from "node:crypto";
import { ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { OrigenCliente, TipoCliente } from "@app/database";
import { PrismaService } from "../../common/prisma.service";
import { rethrowPrismaError } from "../../common/prisma-errors";
import { sha256 } from "../../common/hash.util";
import { validarClienteNoDuplicado } from "../../common/cliente-duplicate-check";
import { parseDurationMs, parseDurationSeconds } from "../auth/duration.util";
import type { ClienteAccessTokenPayload } from "./strategies/cliente-jwt.strategy";
import { RegisterClienteDto } from "./dto/register-cliente.dto";
import { ClienteEmailService } from "./cliente-email.service";

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

// Mismo cost factor que ya usa UsuariosService para Usuario.passwordHash — consistencia entre los
// dos sistemas de auth de la app.
const SALT_ROUNDS = 12;

type ClienteBasico = { id: string; nombre: string; email: string | null };

@Injectable()
export class ClienteAuthService {
  private readonly logger = new Logger(ClienteAuthService.name);
  private readonly accessExpiresIn = process.env.CLIENTE_JWT_ACCESS_EXPIRES_IN ?? "30m";
  private readonly refreshExpiresIn = process.env.CLIENTE_JWT_REFRESH_EXPIRES_IN ?? "7d";
  private readonly refreshSecret = process.env.CLIENTE_JWT_REFRESH_SECRET ?? "development-cliente-refresh-secret";

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: ClienteEmailService,
  ) {}

  private async issueTokens(cliente: { id: string }) {
    const payload: ClienteAccessTokenPayload = { sub: cliente.id, scope: "cliente" };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: parseDurationSeconds(this.accessExpiresIn) });

    const refreshToken = await this.jwt.signAsync(
      { sub: cliente.id },
      { secret: this.refreshSecret, expiresIn: parseDurationSeconds(this.refreshExpiresIn) },
    );
    await this.prisma.clienteRefreshToken.create({
      data: {
        clienteId: cliente.id,
        tokenHash: sha256(refreshToken),
        expiraEn: new Date(Date.now() + parseDurationMs(this.refreshExpiresIn)),
      },
    });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterClienteDto) {
    const email = dto.email.trim().toLowerCase();
    await validarClienteNoDuplicado(this.prisma, { email });

    const passwordHash = await hash(dto.password, SALT_ROUNDS);
    let cliente: ClienteBasico;
    try {
      cliente = await this.prisma.cliente.create({
        data: {
          tipo: TipoCliente.NATURAL,
          nombre: dto.nombre.trim(),
          email,
          telefono: dto.telefono,
          passwordHash,
          origen: OrigenCliente.WEB,
        },
      });
    } catch (error) {
      rethrowPrismaError(error, "Cliente");
    }

    const tokens = await this.issueTokens(cliente);
    return { ...tokens, cliente: { id: cliente.id, nombre: cliente.nombre, email: cliente.email } };
  }

  async login(email: string, password: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Cuenta solo-Google (passwordHash null) recibe el mismo genérico que un email/contraseña
    // equivocados — nunca revelar si la cuenta existe ni cómo fue creada.
    const passwordIsValid = cliente?.passwordHash ? await compare(password, cliente.passwordHash) : false;

    if (!cliente || !passwordIsValid || !cliente.activo) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    const tokens = await this.issueTokens(cliente);
    return { ...tokens, cliente: { id: cliente.id, nombre: cliente.nombre, email: cliente.email } };
  }

  /** Busca por googleId; si no existe, intenta vincular por email a un cliente ya registrado (ej. con
   * contraseña); si tampoco, crea uno nuevo. Llamado desde GoogleStrategy.validate(). */
  async findOrCreateFromGoogle(profile: { googleId: string; email: string; nombre: string }) {
    const porGoogleId = await this.prisma.cliente.findUnique({ where: { googleId: profile.googleId } });
    if (porGoogleId) return porGoogleId;

    const porEmail = await this.prisma.cliente.findUnique({ where: { email: profile.email } });
    if (porEmail) {
      return this.prisma.cliente.update({ where: { id: porEmail.id }, data: { googleId: profile.googleId } });
    }

    return this.prisma.cliente.create({
      data: {
        tipo: TipoCliente.NATURAL,
        nombre: profile.nombre,
        email: profile.email,
        googleId: profile.googleId,
        origen: OrigenCliente.WEB,
      },
    });
  }

  /** Usado por el controller tras resolver un login de Google (GoogleStrategy ya dejó el Cliente en
   * request.user) — mismo issueTokens que register/login. */
  async issueTokensFor(cliente: { id: string }) {
    return this.issueTokens(cliente);
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = sha256(refreshToken);

    const stored = await this.prisma.clienteRefreshToken.findFirst({
      where: { clienteId: payload.sub, tokenHash, revocado: false },
    });
    if (!stored || stored.expiraEn < new Date()) {
      throw new UnauthorizedException("Refresh token inválido o expirado");
    }

    const cliente = await this.prisma.cliente.findUnique({ where: { id: payload.sub } });
    if (!cliente || !cliente.activo) {
      throw new UnauthorizedException("Refresh token inválido o expirado");
    }

    const [tokens] = await Promise.all([
      this.issueTokens(cliente),
      this.prisma.clienteRefreshToken.update({ where: { id: stored.id }, data: { revocado: true } }),
    ]);

    return tokens;
  }

  async logout(clienteId: string, refreshToken: string) {
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.clienteRefreshToken.findFirst({
      where: { clienteId, tokenHash, revocado: false },
    });
    if (!stored) {
      throw new ForbiddenException("Refresh token inválido");
    }
    await this.prisma.clienteRefreshToken.update({ where: { id: stored.id }, data: { revocado: true } });
  }

  /** Siempre resuelve sin error, exista o no el email — nunca hay que revelar si una cuenta existe.
   * Si existe, genera un token de un solo uso y manda el link por email (falla en silencio si el
   * envío falla, mismo criterio: no delatar nada por una diferencia de comportamiento observable). */
  async forgotPassword(email: string): Promise<void> {
    const cliente = await this.prisma.cliente.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!cliente || !cliente.email || !cliente.activo) return;

    const rawToken = randomBytes(32).toString("hex");
    await this.prisma.clientePasswordResetToken.create({
      data: {
        clienteId: cliente.id,
        tokenHash: sha256(rawToken),
        expiraEn: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3100";
    const resetUrl = new URL("/restablecer-contrasena", webOrigin);
    resetUrl.searchParams.set("token", rawToken);

    try {
      await this.email.sendPasswordResetEmail(cliente.email, resetUrl.toString());
    } catch (error) {
      this.logger.error(`No se pudo enviar el email de reset a ${cliente.email}`, error as Error);
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const tokenHash = sha256(token);
    const stored = await this.prisma.clientePasswordResetToken.findFirst({
      where: { tokenHash, usado: false },
    });
    if (!stored || stored.expiraEn < new Date()) {
      throw new UnauthorizedException("El link para restablecer la contraseña es inválido o expiró.");
    }

    const passwordHash = await hash(password, SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.cliente.update({ where: { id: stored.clienteId }, data: { passwordHash } }),
      this.prisma.clientePasswordResetToken.update({ where: { id: stored.id }, data: { usado: true } }),
      // Cambiaste la contraseña: cualquier sesión abierta en otro dispositivo/navegador queda
      // invalidada, tiene que volver a loguearse.
      this.prisma.clienteRefreshToken.updateMany({
        where: { clienteId: stored.clienteId, revocado: false },
        data: { revocado: true },
      }),
    ]);
  }

  private async verifyRefreshToken(refreshToken: string): Promise<{ sub: string }> {
    try {
      return await this.jwt.verifyAsync<{ sub: string }>(refreshToken, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException("Refresh token inválido o expirado");
    }
  }
}
