import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { ProformasService } from "./proformas.service";
import { ProformaApprovalService } from "./proforma-approval.service";
import { ProformaCompletionService } from "./proforma-completion.service";
import { CreateProformaDto } from "./dto/create-proforma.dto";
import { UpdateProformaDto } from "./dto/update-proforma.dto";
import { QueryProformaDto } from "./dto/query-proforma.dto";
import { AddDetalleVentaDto } from "./dto/add-detalle-venta.dto";
import { AddDetalleCompraDto } from "./dto/add-detalle-compra.dto";
import { UpdateDetalleDto } from "./dto/update-detalle.dto";
import { TransitionProformaDto } from "./dto/transition-proforma.dto";
import { AprobarProformaDto } from "./dto/aprobar-proforma.dto";
import { CompletarProformaDto } from "./dto/completar-proforma.dto";

/**
 * No se restringe por rol más allá de ADMIN/SELLER genérico — fuera de alcance construir un sistema
 * de permisos granular nuevo (spec).
 */
@ApiTags("proformas")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("proformas")
export class ProformasController {
  constructor(
    private readonly proformas: ProformasService,
    private readonly approval: ProformaApprovalService,
    private readonly completion: ProformaCompletionService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Lista proformas (paginado, filtros por tipo/estado/empresa)." })
  findAll(@Query() query: QueryProformaDto) {
    return this.proformas.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Detalle completo de una proforma: líneas, asignaciones, historial." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.proformas.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Crea una proforma en BORRADOR. creadoPorId sale del usuario autenticado." })
  create(@Body() dto: CreateProformaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.proformas.create(dto, user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualiza la cabecera de una proforma. Solo mientras está en BORRADOR." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateProformaDto) {
    return this.proformas.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Elimina una proforma. Solo mientras está en BORRADOR." })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.proformas.remove(id);
  }

  @Post(":id/detalles/venta")
  @ApiOperation({ summary: "Agrega una línea a una proforma de VENTA. precioUnitario nace de precioFinalBs si se omite." })
  addDetalleVenta(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AddDetalleVentaDto) {
    return this.proformas.addDetalleVenta(id, dto);
  }

  @Post(":id/detalles/compra")
  @ApiOperation({ summary: "Agrega una línea a una proforma de COMPRA con los 4 costos de esa compra puntual." })
  addDetalleCompra(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AddDetalleCompraDto) {
    return this.proformas.addDetalleCompra(id, dto);
  }

  @Patch(":id/detalles/:detalleId")
  @ApiOperation({ summary: "Edita una línea existente. Solo mientras la proforma está en BORRADOR." })
  updateDetalle(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("detalleId", ParseUUIDPipe) detalleId: string,
    @Body() dto: UpdateDetalleDto,
  ) {
    return this.proformas.updateDetalle(id, detalleId, dto);
  }

  @Delete(":id/detalles/:detalleId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Quita una línea. Solo mientras la proforma está en BORRADOR." })
  removeDetalle(@Param("id", ParseUUIDPipe) id: string, @Param("detalleId", ParseUUIDPipe) detalleId: string) {
    return this.proformas.removeDetalle(id, detalleId);
  }

  @Post(":id/aprobar")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "BORRADOR → APROBADA. En VENTA recibe almacenId y reserva stock contra él (STOCK/PROCURA); en COMPRA es una transición simple. Nunca bloquea por falta de stock.",
  })
  @ApiResponse({ status: 409, description: "Ya no está en BORRADOR (aprobación concurrente u otro estado)." })
  aprobar(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AprobarProformaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.approval.aprobar(id, user.id, dto.almacenId);
  }

  @Post(":id/anular")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "APROBADA → ANULADA (libera las reservas de stock hechas al aprobar)." })
  anular(@Param("id", ParseUUIDPipe) id: string, @Body() dto: TransitionProformaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.approval.anular(id, user.id, dto.nota);
  }

  @Post(":id/completar")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "APROBADA → COMPLETADA. En COMPRA recibe almacenId, crea los lotes y suma stock físico (y resuelve sola cualquier Procura pendiente de ventas aprobadas). En VENTA recibe el reparto manual de lotes (asignaciones) y descuenta stock reservado/físico — bloqueada mientras quede Procura pendiente.",
  })
  @ApiResponse({ status: 409, description: "Ya no está en APROBADA, queda Procura pendiente, o inconsistencia al consumir lotes." })
  completar(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CompletarProformaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.completion.completar(id, user.id, dto);
  }
}
