import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";
import { EnviosService } from "./envios.service";
import { CreateEnvioDto, CreateRecepcionDto, EnvioItemDto, QueryEnvioDto, UpdateEnvioDto, UpdateEnvioItemDto } from "./dto/envio.dto";

@ApiTags("envios")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("envios")
export class EnviosController {
  constructor(private readonly envios: EnviosService) {}

  @Get()
  @ApiOperation({ summary: "Lista envíos (paginado, filtro por estado)." })
  findAll(@Query() query: QueryEnvioDto) {
    return this.envios.findAll(query);
  }

  // Ruta estática antes de ":id" — si no, Express la matchea como un id.
  @Get("disponibles")
  @ApiOperation({ summary: "Productos ya recogidos que todavía no están (del todo) en ningún envío." })
  disponibles() {
    return this.envios.findDisponibles();
  }

  @Get(":id")
  @ApiOperation({ summary: "Detalle de un envío: productos, recepciones y avance." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.envios.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Crea un envío (ARMANDO) hacia un almacén, opcionalmente con productos recogidos." })
  create(@Body() dto: CreateEnvioDto, @CurrentUser() user: AuthenticatedUser) {
    return this.envios.create(dto, user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edita almacén destino/nota (solo ARMANDO)." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateEnvioDto) {
    return this.envios.update(id, dto);
  }

  @Post(":id/items")
  @ApiOperation({ summary: "Suma productos recogidos al envío (solo ARMANDO)." })
  agregarItem(@Param("id", ParseUUIDPipe) id: string, @Body() dto: EnvioItemDto) {
    return this.envios.agregarItem(id, dto);
  }

  @Patch(":id/items/:itemId")
  @ApiOperation({ summary: "Cambia la cantidad de un producto del envío (solo ARMANDO)." })
  updateItem(@Param("id", ParseUUIDPipe) id: string, @Param("itemId", ParseUUIDPipe) itemId: string, @Body() dto: UpdateEnvioItemDto) {
    return this.envios.updateItem(id, itemId, dto);
  }

  @Delete(":id/items/:itemId")
  @ApiOperation({ summary: "Saca un producto del envío (solo ARMANDO)." })
  quitarItem(@Param("id", ParseUUIDPipe) id: string, @Param("itemId", ParseUUIDPipe) itemId: string) {
    return this.envios.quitarItem(id, itemId);
  }

  @Post(":id/en-transito")
  @ApiOperation({ summary: "ARMANDO → EN_TRANSITO (el envío salió)." })
  marcarEnTransito(@Param("id", ParseUUIDPipe) id: string) {
    return this.envios.marcarEnTransito(id);
  }

  @Post(":id/anular")
  @ApiOperation({ summary: "Anula el envío (sus productos vuelven a estar por enviar). No si ya recibió parte." })
  anular(@Param("id", ParseUUIDPipe) id: string) {
    return this.envios.anular(id);
  }

  @Post(":id/recepciones")
  @ApiOperation({ summary: "Registra lo que llegó (parcial o total): crea lotes/stock; el resto sigue en camino." })
  recibir(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateRecepcionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.envios.recibir(id, dto, user.id);
  }

  @Post(":id/cerrar")
  @ApiOperation({ summary: "Cierra el envío dando por no llegado lo que falta (vuelve a estar por enviar)." })
  cerrar(@Param("id", ParseUUIDPipe) id: string) {
    return this.envios.cerrar(id);
  }
}
