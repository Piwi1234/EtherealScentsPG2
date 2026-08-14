import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { MovimientoService } from "./movimiento.service";
import { CreateMovimientoDto } from "./dto/create-movimiento.dto";
import { QueryMovimientoDto } from "./dto/query-movimiento.dto";

@ApiTags("contabilidad")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("contabilidad/carteras/:carteraId/movimientos")
export class MovimientoController {
  constructor(private readonly movimientos: MovimientoService) {}

  @Get()
  @ApiOperation({ summary: "Libro de caja de una cartera, con saldo acumulado (Total) por fila." })
  findAll(@Param("carteraId", ParseUUIDPipe) carteraId: string, @Query() query: QueryMovimientoDto) {
    return this.movimientos.findAll(carteraId, query);
  }

  @Post()
  @ApiOperation({ summary: "Carga un ingreso o gasto. Inmutable — no hay PATCH/DELETE." })
  create(
    @Param("carteraId", ParseUUIDPipe) carteraId: string,
    @Body() dto: CreateMovimientoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.movimientos.create(carteraId, dto, user.id);
  }
}
