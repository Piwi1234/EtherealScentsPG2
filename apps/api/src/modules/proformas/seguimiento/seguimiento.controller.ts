import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";
import { SeguimientoService } from "./seguimiento.service";
import { CreateSeguimientoDto } from "./dto/create-seguimiento.dto";

@ApiTags("proformas")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("proformas/detalles/:detalleId/seguimiento")
export class SeguimientoController {
  constructor(private readonly seguimiento: SeguimientoService) {}

  @Get()
  @ApiOperation({ summary: "Historial de seguimiento interno de una línea (más reciente primero)." })
  findAll(@Param("detalleId", ParseUUIDPipe) detalleId: string) {
    return this.seguimiento.findAll(detalleId);
  }

  @Post()
  @ApiOperation({ summary: "Registra un nuevo estado de seguimiento. Solo si la proforma está APROBADA o COMPLETADA." })
  create(
    @Param("detalleId", ParseUUIDPipe) detalleId: string,
    @Body() dto: CreateSeguimientoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.seguimiento.create(detalleId, dto, user.id);
  }
}
