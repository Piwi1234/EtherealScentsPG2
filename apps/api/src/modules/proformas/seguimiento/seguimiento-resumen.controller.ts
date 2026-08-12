import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../../auth/decorators/roles.decorator";
import { SeguimientoService } from "./seguimiento.service";
import { QuerySeguimientoDto } from "./dto/query-seguimiento.dto";
import { UpdateEstadoSeguimientoDto } from "./dto/update-estado-seguimiento.dto";

@ApiTags("proformas")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("proformas/seguimiento")
export class SeguimientoResumenController {
  constructor(private readonly seguimiento: SeguimientoService) {}

  @Get()
  @ApiOperation({ summary: "Todo lo que hoy está a Procura (venta aprobada sin stock suficiente), de cualquier proforma." })
  findPendientes(@Query() query: QuerySeguimientoDto) {
    return this.seguimiento.findPendientes(query);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Marca una línea a Procura como Pendiente o Enviado (al proveedor)." })
  updateEstado(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateEstadoSeguimientoDto) {
    return this.seguimiento.updateEstado(id, dto);
  }
}
