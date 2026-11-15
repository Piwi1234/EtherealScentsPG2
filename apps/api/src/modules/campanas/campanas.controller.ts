import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { CampanaService } from "./campana.service";
import { CrearCampanaDto, VistaPreviaCampanaDto } from "./dto/campana.dto";

/** Gestión de campañas de descuento (solo administrador). */
@ApiTags("campanas")
@ApiBearerAuth()
@Roles(Rol.ADMIN)
@Controller("campanas")
export class CampanasController {
  constructor(private readonly campanas: CampanaService) {}

  @Get()
  @ApiOperation({ summary: "Lista las campañas (más recientes primero)." })
  list() {
    return this.campanas.list();
  }

  // Ruta estática antes de ":id".
  @Post("vista-previa")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Calcula qué precios cambiaría una campaña, sin aplicarla." })
  vistaPrevia(@Body() dto: VistaPreviaCampanaDto) {
    return this.campanas.vistaPrevia(dto);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.campanas.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Crea una campaña (borrador, o ya programada con `programar: true`)." })
  crear(@Body() dto: CrearCampanaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.campanas.crear(dto, user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edita una campaña en borrador." })
  actualizar(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CrearCampanaDto) {
    return this.campanas.actualizar(id, dto);
  }

  @Post(":id/programar")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Programa una campaña en borrador: empieza sola en su fecha de inicio." })
  programar(@Param("id", ParseUUIDPipe) id: string) {
    return this.campanas.programar(id);
  }

  @Post(":id/revertir")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Termina la campaña ya y restaura los precios que tenían antes." })
  revertir(@Param("id", ParseUUIDPipe) id: string) {
    return this.campanas.revertir(id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Elimina una campaña en borrador." })
  eliminar(@Param("id", ParseUUIDPipe) id: string) {
    return this.campanas.eliminar(id);
  }
}

/** Lo que la tienda pública necesita saber: si hay una campaña activa, cómo se llama y cuándo termina. */
@Public()
@ApiTags("catalog")
@Controller("catalog/campana")
export class CampanaPublicaController {
  constructor(private readonly campanas: CampanaService) {}

  @Get()
  activa() {
    return this.campanas.activaPublica();
  }
}
