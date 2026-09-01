import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { Public } from "../auth/decorators/public.decorator";
import { RefreshTokenDto } from "../auth/dto/refresh-token.dto";
import { ClienteAuthService } from "./cliente-auth.service";
import { RegisterClienteDto } from "./dto/register-cliente.dto";
import { LoginClienteDto } from "./dto/login-cliente.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { UpdateClientePerfilDto } from "./dto/update-cliente-perfil.dto";
import { ClienteJwtAuthGuard } from "./guards/cliente-jwt-auth.guard";
import { CurrentCliente } from "./decorators/current-cliente.decorator";
import type { AuthenticatedCliente } from "./strategies/cliente-jwt.strategy";

/** Todo público a nivel de clase (saltea el JwtAuthGuard global de gestión, que valida scope
 * "gestion" — un token de cliente jamás pasaría ahí igual). Las rutas que sí necesitan un cliente
 * logueado usan @UseGuards(ClienteJwtAuthGuard) puntual, no global. */
@Public()
@ApiTags("cliente-auth")
@Controller("cliente-auth")
export class ClienteAuthController {
  constructor(private readonly clienteAuth: ClienteAuthService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Autorregistro de un cliente con email/contraseña." })
  @ApiResponse({ status: 201, description: "accessToken + refreshToken + datos del cliente." })
  @ApiResponse({ status: 409, description: "Ya existe un cliente con ese email." })
  register(@Body() dto: RegisterClienteDto) {
    return this.clienteAuth.register(dto);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login de un cliente con email/contraseña." })
  @ApiResponse({ status: 200, description: "accessToken + refreshToken + datos del cliente." })
  @ApiResponse({ status: 401, description: "Credenciales inválidas." })
  login(@Body() dto: LoginClienteDto) {
    return this.clienteAuth.login(dto.email, dto.password);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Pide el link para restablecer la contraseña. Siempre responde 200, exista o no el email." })
  @ApiResponse({ status: 200, description: "Mensaje genérico (no revela si el email existe)." })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.clienteAuth.forgotPassword(dto.email);
    return { message: "Si el email existe, te enviamos un link para restablecer la contraseña." };
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Establece una contraseña nueva a partir del token recibido por email." })
  @ApiResponse({ status: 200, description: "Contraseña actualizada." })
  @ApiResponse({ status: 401, description: "Token inválido, ya usado o expirado." })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.clienteAuth.resetPassword(dto.token, dto.password);
    return { message: "Contraseña actualizada." };
  }

  @Post("refresh-token")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rota el refresh token del cliente: revoca el usado y emite un par nuevo." })
  @ApiResponse({ status: 200, description: "accessToken + refreshToken nuevos." })
  @ApiResponse({ status: 401, description: "Refresh token inválido, revocado o expirado." })
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.clienteAuth.refresh(dto.refreshToken);
  }

  @UseGuards(ClienteJwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoca el refresh token indicado (requiere access token de cliente vigente)." })
  @ApiResponse({ status: 204, description: "Sesión cerrada." })
  logout(@CurrentCliente() cliente: AuthenticatedCliente, @Body() dto: RefreshTokenDto) {
    return this.clienteAuth.logout(cliente.id, dto.refreshToken);
  }

  @UseGuards(ClienteJwtAuthGuard)
  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Datos del cliente logueado." })
  getMe(@CurrentCliente() cliente: AuthenticatedCliente) {
    return this.clienteAuth.getProfile(cliente.id);
  }

  @UseGuards(ClienteJwtAuthGuard)
  @Patch("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Actualiza los datos de contacto del cliente logueado (no email ni documento)." })
  updateMe(@CurrentCliente() cliente: AuthenticatedCliente, @Body() dto: UpdateClientePerfilDto) {
    return this.clienteAuth.updateProfile(cliente.id, dto);
  }

  @Get("google")
  @UseGuards(AuthGuard("google"))
  @ApiOperation({ summary: "Dispara el redirect al consentimiento de Google (passport-google-oauth20)." })
  googleAuth() {
    // Cuerpo vacío a propósito: AuthGuard("google") intercepta y redirige antes de llegar acá.
  }

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  @ApiOperation({ summary: "Callback de Google: arma el par de tokens y redirige al frontend." })
  async googleCallback(
    @Req() req: Request & { user: { id: string; nombre: string; email: string | null } },
    @Res() res: Response,
  ) {
    const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3100";
    try {
      const tokens = await this.clienteAuth.issueTokensFor(req.user);
      const redirectUrl = new URL("/auth/google/callback", webOrigin);
      redirectUrl.searchParams.set("accessToken", tokens.accessToken);
      redirectUrl.searchParams.set("refreshToken", tokens.refreshToken);
      redirectUrl.searchParams.set("id", req.user.id);
      redirectUrl.searchParams.set("nombre", req.user.nombre);
      if (req.user.email) redirectUrl.searchParams.set("email", req.user.email);
      return res.redirect(redirectUrl.toString());
    } catch {
      const errorUrl = new URL("/auth/google/callback", webOrigin);
      errorUrl.searchParams.set("error", "google");
      return res.redirect(errorUrl.toString());
    }
  }
}
