import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { CuentaPorCobrarService } from "./cuenta-por-cobrar.service";
import { CobrarCuentaDto } from "./dto/cobrar-cuenta.dto";
import { QueryCuentaPorCobrarDto } from "./dto/query-cuenta-por-cobrar.dto";

@ApiTags("contabilidad")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("contabilidad/cuentas-por-cobrar")
export class CuentaPorCobrarController {
  constructor(private readonly cuentas: CuentaPorCobrarService) {}

  @Get()
  @ApiOperation({ summary: "Lista cuentas por cobrar (una por VENTA completada con saldo pendiente), filtro por estado." })
  findAll(@Query() query: QueryCuentaPorCobrarDto) {
    return this.cuentas.findAll(query);
  }

  @Post(":id/cobrar")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cobro parcial o total contra una cuenta por cobrar — nunca más de lo adeudado." })
  cobrar(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CobrarCuentaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cuentas.cobrar(id, dto, user.id);
  }
}
