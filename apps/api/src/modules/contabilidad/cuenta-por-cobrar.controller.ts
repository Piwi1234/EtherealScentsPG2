import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { CuentaPorCobrarService } from "./cuenta-por-cobrar.service";
import { CuentaPorCobrarPdfService } from "./cuenta-por-cobrar-pdf.service";
import { CobrarCuentaDto } from "./dto/cobrar-cuenta.dto";
import { QueryCuentaPorCobrarDto } from "./dto/query-cuenta-por-cobrar.dto";

@ApiTags("contabilidad")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("contabilidad/cuentas-por-cobrar")
export class CuentaPorCobrarController {
  constructor(
    private readonly cuentas: CuentaPorCobrarService,
    private readonly pdf: CuentaPorCobrarPdfService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Lista cuentas por cobrar (una por VENTA completada con saldo pendiente), filtro por estado." })
  findAll(@Query() query: QueryCuentaPorCobrarDto) {
    return this.cuentas.findAll(query);
  }

  @Get("por-cliente")
  @ApiOperation({ summary: "Las mismas cuentas agrupadas por cliente (paginado por cliente), con los totales de cada uno." })
  findAllPorCliente(@Query() query: QueryCuentaPorCobrarDto) {
    return this.cuentas.findAllPorCliente(query);
  }

  @Get("cliente/:clienteId/pdf")
  @ApiOperation({ summary: "Estado de cuenta en PDF (A4) con las deudas pendientes de un cliente; respeta fechaDesde/fechaHasta." })
  async downloadPdf(@Param("clienteId", ParseUUIDPipe) clienteId: string, @Query() query: QueryCuentaPorCobrarDto, @Res() res: Response) {
    const buffer = await this.pdf.generate(clienteId, { fechaDesde: query.fechaDesde, fechaHasta: query.fechaHasta });
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="estado-de-cuenta-${clienteId}.pdf"`,
      "Content-Length": String(buffer.length),
    });
    res.send(buffer);
  }

  @Post(":id/cobrar")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cobro parcial o total contra una cuenta por cobrar — nunca más de lo adeudado." })
  cobrar(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CobrarCuentaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cuentas.cobrar(id, dto, user.id);
  }
}
