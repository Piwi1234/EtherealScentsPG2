import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { TraspasoAlmacenService } from "./traspaso-almacen.service";
import { CreateTraspasoAlmacenDto } from "./dto/create-traspaso-almacen.dto";

// Path propio (no anidado bajo /almacenes) para no colisionar con la ruta @Get(":id") de
// AlmacenController — "traspasos-almacen" nunca puede ambigüarse con un id de almacén.
@ApiTags("traspasos-almacen")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("traspasos-almacen")
export class TraspasoAlmacenController {
  constructor(private readonly traspasos: TraspasoAlmacenService) {}

  @Get()
  @ApiOperation({ summary: "Lista traspasos de stock entre almacenes (paginado, filtro por variante/almacén)." })
  findAll(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("varianteId") varianteId?: string,
    @Query("almacenId") almacenId?: string,
  ) {
    return this.traspasos.findAll({ page, pageSize, varianteId, almacenId });
  }

  @Post()
  @ApiOperation({ summary: "Traspasa stock físico de una variante entre dos almacenes — instantáneo, mueve también los lotes de origen." })
  create(@Body() dto: CreateTraspasoAlmacenDto, @CurrentUser() user: AuthenticatedUser) {
    return this.traspasos.create(dto, user.id);
  }
}
