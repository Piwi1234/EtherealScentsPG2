import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RegistrosService } from "./registros.service";
import { QueryRegistrosDto } from "./dto/query-registros.dto";

@ApiTags("proformas")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("proformas/registros")
export class RegistrosController {
  constructor(private readonly registros: RegistrosService) {}

  @Get()
  @ApiOperation({ summary: "Ledger de líneas de proforma (COMPRA o VENTA), filtrable por fecha/categoría/marca/producto." })
  findAll(@Query() query: QueryRegistrosDto) {
    return this.registros.findAll(query);
  }
}
