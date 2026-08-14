import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { TraspasoService } from "./traspaso.service";
import { CreateTraspasoDto } from "./dto/create-traspaso.dto";

@ApiTags("contabilidad")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("contabilidad/traspasos")
export class TraspasoController {
  constructor(private readonly traspasos: TraspasoService) {}

  @Post()
  @ApiOperation({ summary: "Mueve un monto entre 2 carteras, incluso de monedas distintas (con tipo de cambio)." })
  create(@Body() dto: CreateTraspasoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.traspasos.create(dto, user.id);
  }
}
