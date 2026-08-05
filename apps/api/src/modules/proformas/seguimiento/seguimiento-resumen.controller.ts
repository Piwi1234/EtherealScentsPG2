import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../../auth/decorators/roles.decorator";
import { SeguimientoService } from "./seguimiento.service";
import { QuerySeguimientoDto } from "./dto/query-seguimiento.dto";

/** Separado de SeguimientoController (que cuelga de /proformas/detalles/:detalleId/seguimiento) para
 * no mezclar la ruta de una línea puntual con la vista agregada de todas las proformas. */
@ApiTags("proformas")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("proformas/seguimiento")
export class SeguimientoResumenController {
  constructor(private readonly seguimiento: SeguimientoService) {}

  @Get()
  @ApiOperation({ summary: "Todas las líneas con seguimiento habilitado, de cualquier proforma APROBADA o COMPLETADA." })
  findPendientes(@Query() query: QuerySeguimientoDto) {
    return this.seguimiento.findPendientes(query);
  }
}
