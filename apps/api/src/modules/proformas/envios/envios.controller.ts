import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";
import { EnviosService } from "./envios.service";
import { CreateEnvioDto, QueryEnvioDto, UpdateEnvioDto, UpdateRecepcionLineaDto } from "./dto/envio.dto";

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
  @Get("compras-disponibles")
  @ApiOperation({ summary: "Compras APROBADAS que todavía no están en ningún envío." })
  comprasDisponibles() {
    return this.envios.findComprasDisponibles();
  }

  @Get(":id")
  @ApiOperation({ summary: "Detalle de un envío: compras, líneas y recepción." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.envios.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Crea un envío (ARMANDO) hacia un almacén, opcionalmente con compras." })
  create(@Body() dto: CreateEnvioDto, @CurrentUser() user: AuthenticatedUser) {
    return this.envios.create(dto, user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edita almacén destino/nota (solo ARMANDO)." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateEnvioDto) {
    return this.envios.update(id, dto);
  }

  @Post(":id/compras/:proformaId")
  @ApiOperation({ summary: "Agrega una compra APROBADA al envío (solo ARMANDO)." })
  agregarCompra(@Param("id", ParseUUIDPipe) id: string, @Param("proformaId", ParseUUIDPipe) proformaId: string) {
    return this.envios.agregarCompra(id, proformaId);
  }

  @Delete(":id/compras/:proformaId")
  @ApiOperation({ summary: "Quita una compra del envío (solo ARMANDO)." })
  quitarCompra(@Param("id", ParseUUIDPipe) id: string, @Param("proformaId", ParseUUIDPipe) proformaId: string) {
    return this.envios.quitarCompra(id, proformaId);
  }

  @Post(":id/en-transito")
  @ApiOperation({ summary: "ARMANDO → EN_TRANSITO (el envío salió)." })
  marcarEnTransito(@Param("id", ParseUUIDPipe) id: string) {
    return this.envios.marcarEnTransito(id);
  }

  @Post(":id/anular")
  @ApiOperation({ summary: "Anula el envío (libera sus compras)." })
  anular(@Param("id", ParseUUIDPipe) id: string) {
    return this.envios.anular(id);
  }

  @Post(":id/recepcion")
  @ApiOperation({ summary: "Abre la recepción: genera la foto de lo esperado para corregir." })
  iniciarRecepcion(@Param("id", ParseUUIDPipe) id: string) {
    return this.envios.iniciarRecepcion(id);
  }

  // "confirmar" (estático) antes de ":lineaId" en el mismo nivel.
  @Post(":id/recepcion/confirmar")
  @ApiOperation({ summary: "Confirma lo recibido: crea lotes/stock y completa las compras del envío." })
  confirmarRecepcion(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.envios.confirmarRecepcion(id, user.id);
  }

  @Patch(":id/recepcion/:lineaId")
  @ApiOperation({ summary: "Corrige una línea de la recepción (cantidad recibida / variante recibida / nota)." })
  updateRecepcionLinea(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("lineaId", ParseUUIDPipe) lineaId: string,
    @Body() dto: UpdateRecepcionLineaDto,
  ) {
    return this.envios.updateRecepcionLinea(id, lineaId, dto);
  }
}
