import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";
import { RecojosService } from "./recojos.service";
import { CreateRecojoDto } from "./dto/recojo.dto";

@ApiTags("proformas")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("proformas")
export class RecojosController {
  constructor(private readonly recojos: RecojosService) {}

  @Get(":id/recojos")
  @ApiOperation({ summary: "Recojos de una compra y el resumen por línea (comprado / recogido / por recoger)." })
  listar(@Param("id", ParseUUIDPipe) id: string) {
    return this.recojos.listar(id);
  }

  @Post(":id/recojos")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Registra un recojo (parcial o completo) de una compra aprobada." })
  crear(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateRecojoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.recojos.crear(id, dto, user.id);
  }

  @Delete("recojos/:recojoId")
  @ApiOperation({ summary: "Deshace un recojo cargado por error." })
  anular(@Param("recojoId", ParseUUIDPipe) recojoId: string) {
    return this.recojos.anular(recojoId);
  }
}
