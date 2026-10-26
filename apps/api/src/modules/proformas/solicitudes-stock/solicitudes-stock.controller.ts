import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";
import { SolicitudesStockService } from "./solicitudes-stock.service";
import {
  CreateSolicitudDto,
  LineaSolicitudDto,
  QuerySolicitudDto,
  UpdateLineaSolicitudDto,
  UpdateSolicitudDto,
  VincularLineaSolicitudDto,
} from "./dto/solicitud.dto";

@ApiTags("solicitudes-stock")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("solicitudes-stock")
export class SolicitudesStockController {
  constructor(private readonly solicitudes: SolicitudesStockService) {}

  @Get()
  @ApiOperation({ summary: "Lista solicitudes de stock (filtro por estado y búsqueda por código o producto)." })
  findAll(@Query() query: QuerySolicitudDto) {
    return this.solicitudes.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: "Crea una solicitud de stock (con líneas iniciales opcionales)." })
  create(@Body() dto: CreateSolicitudDto, @CurrentUser() user: AuthenticatedUser) {
    return this.solicitudes.create(dto, user.id);
  }

  // Rutas "lineas/:lineaId/vincular" (3 segmentos) no chocan con ":id/..." pero van antes por claridad.
  @Post("lineas/:lineaId/vincular")
  @ApiOperation({ summary: "Liga (todo o parte de) una línea de solicitud a una línea de compra." })
  vincular(@Param("lineaId", ParseUUIDPipe) lineaId: string, @Body() dto: VincularLineaSolicitudDto) {
    return this.solicitudes.vincularLinea(lineaId, dto.compraDetalleId, dto.cantidad);
  }

  @Delete("lineas/:lineaId/vincular")
  @ApiOperation({ summary: "Suelta una línea de solicitud de su compra." })
  desvincular(@Param("lineaId", ParseUUIDPipe) lineaId: string) {
    return this.solicitudes.desvincularLinea(lineaId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Detalle de una solicitud con sus líneas y el estado derivado de cada una." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.solicitudes.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edita la nota de la solicitud." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateSolicitudDto) {
    return this.solicitudes.update(id, dto);
  }

  @Post(":id/cancelar")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Cancela la solicitud: sus líneas se sueltan de las compras y deja de aparecer en Seguimiento." })
  cancelar(@Param("id", ParseUUIDPipe) id: string) {
    return this.solicitudes.cancelar(id);
  }

  @Post(":id/lineas")
  @ApiOperation({ summary: "Agrega un producto a la solicitud (si ya hay una línea libre del mismo producto, se suma)." })
  addLinea(@Param("id", ParseUUIDPipe) id: string, @Body() dto: LineaSolicitudDto) {
    return this.solicitudes.addLinea(id, dto);
  }

  @Patch(":id/lineas/:lineaId")
  @ApiOperation({ summary: "Edita cantidad o nota de una línea todavía sin compra." })
  updateLinea(@Param("id", ParseUUIDPipe) id: string, @Param("lineaId", ParseUUIDPipe) lineaId: string, @Body() dto: UpdateLineaSolicitudDto) {
    return this.solicitudes.updateLinea(id, lineaId, dto);
  }

  @Delete(":id/lineas/:lineaId")
  @ApiOperation({ summary: "Quita una línea todavía sin compra." })
  removeLinea(@Param("id", ParseUUIDPipe) id: string, @Param("lineaId", ParseUUIDPipe) lineaId: string) {
    return this.solicitudes.removeLinea(id, lineaId);
  }
}
