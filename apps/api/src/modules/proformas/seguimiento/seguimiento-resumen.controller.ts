import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../../auth/decorators/roles.decorator";
import { SeguimientoService } from "./seguimiento.service";
import { SeguimientoExportService, type VistaSeguimiento } from "./seguimiento-export.service";
import { QuerySeguimientoDto } from "./dto/query-seguimiento.dto";
import { UpdateEstadoSeguimientoDto } from "./dto/update-estado-seguimiento.dto";
import { VincularCompraDto } from "./dto/vincular.dto";
import { CrearComprasDto } from "./dto/crear-compras.dto";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../auth/strategies/jwt.strategy";

@ApiTags("proformas")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("proformas/seguimiento")
export class SeguimientoResumenController {
  constructor(
    private readonly seguimiento: SeguimientoService,
    private readonly exportar: SeguimientoExportService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Pedidos de clientes: todo lo que hoy está a Procura, con el estado derivado de la compra/envío que lo cubre." })
  findPendientes(@Query() query: QuerySeguimientoDto) {
    return this.seguimiento.findPendientes(query);
  }

  // Rutas estáticas antes de ":id".
  @Get("export")
  @ApiOperation({ summary: "Excel de la lista de Seguimiento (vista = pedidos | solicitudes | stock) con los mismos filtros que la pantalla." })
  async exportExcel(@Query("vista") vista: string | undefined, @Query() query: QuerySeguimientoDto, @Res() res: Response) {
    const v: VistaSeguimiento = vista === "stock" ? "stock" : vista === "solicitudes" ? "solicitudes" : "pedidos";
    const buffer = await this.exportar.generar(v, query);
    const nombre = v === "pedidos" ? "seguimiento-pedidos-de-clientes" : v === "solicitudes" ? "seguimiento-stock-solicitado" : "seguimiento-stock-en-compra";
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}.xlsx"`,
    });
    res.send(buffer);
  }

  @Get("stock")
  @ApiOperation({ summary: "Stock pedido: compras para stock ya aprobadas y todavía sin recibir (comprado / en tránsito)." })
  findStockPedido(@Query() query: QuerySeguimientoDto) {
    return this.seguimiento.findStockPedido(query);
  }

  @Get("stock-solicitado")
  @ApiOperation({ summary: "Stock solicitado: líneas de solicitudes de stock abiertas que todavía no llegaron." })
  findStockSolicitado(@Query() query: QuerySeguimientoDto) {
    return this.seguimiento.findStockSolicitado(query);
  }

  @Get("pendientes-por-variante")
  @ApiOperation({ summary: "Faltantes de ventas y líneas de solicitud sin compra de estos productos (varianteIds separados por coma)." })
  pendientesPorVariante(@Query("varianteIds") varianteIds?: string) {
    return this.seguimiento.pendientesPorVariante((varianteIds ?? "").split(",").map((v) => v.trim()).filter(Boolean));
  }

  @Get("sugerencias-compra")
  @ApiOperation({ summary: "Último proveedor al que se le compró cada producto (varianteIds separados por coma)." })
  sugerenciasCompra(@Query("varianteIds") varianteIds?: string) {
    return this.seguimiento.sugerenciasCompra((varianteIds ?? "").split(",").map((v) => v.trim()).filter(Boolean));
  }

  @Post("crear-compras")
  @ApiOperation({ summary: "Crea una nota de compra (borrador) por proveedor desde faltantes de ventas, ya ligadas." })
  crearCompras(@Body() dto: CrearComprasDto, @CurrentUser() user: AuthenticatedUser) {
    return this.seguimiento.crearCompras(dto, user.id);
  }

  @Get("compra/:compraDetalleId/solicitudes")
  @ApiOperation({ summary: "Líneas de solicitudes de stock que esta línea de compra puede cubrir." })
  solicitudesParaCompra(@Param("compraDetalleId", ParseUUIDPipe) compraDetalleId: string) {
    return this.seguimiento.solicitudesPendientesParaCompra(compraDetalleId);
  }

  @Get("compra/:compraDetalleId/procuras")
  @ApiOperation({ summary: "Faltantes de notas de venta que esta línea de compra puede cubrir." })
  procurasParaCompra(@Param("compraDetalleId", ParseUUIDPipe) compraDetalleId: string) {
    return this.seguimiento.procurasPendientesParaCompra(compraDetalleId);
  }

  @Get(":id/compras-candidatas")
  @ApiOperation({ summary: "Líneas de compra (pedido) a las que se puede ligar este faltante." })
  comprasCandidatas(@Param("id", ParseUUIDPipe) id: string) {
    return this.seguimiento.comprasCandidatas(id);
  }

  @Post(":id/vincular")
  @ApiOperation({ summary: "Liga un faltante (Procura) a la línea de compra que viene a cubrirlo." })
  vincular(@Param("id", ParseUUIDPipe) id: string, @Body() dto: VincularCompraDto) {
    return this.seguimiento.vincular(id, dto.compraDetalleId, dto.cantidad);
  }

  @Delete(":id/vincular")
  @ApiOperation({ summary: "Suelta el vínculo de un faltante con su compra." })
  desvincular(@Param("id", ParseUUIDPipe) id: string) {
    return this.seguimiento.desvincular(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Legado: marca manualmente una línea a Procura (el seguimiento ahora se deriva de la compra/envío)." })
  updateEstado(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateEstadoSeguimientoDto) {
    return this.seguimiento.updateEstado(id, dto);
  }
}
