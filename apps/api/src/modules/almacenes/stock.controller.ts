import { Controller, Get, Query, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { StockService } from "./stock.service";
import { StockExportService } from "./stock-export.service";

@ApiTags("stock")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("stock")
export class StockController {
  constructor(
    private readonly stock: StockService,
    private readonly stockExport: StockExportService,
  ) {}

  // Antes de ":id"-like routes — acá no hay ninguna, pero se declara junto al resto de rutas fijas.
  @Get("export")
  @ApiOperation({ summary: "Excel de existencias (stock físico > 0, todos los almacenes), una hoja por categoría raíz." })
  async exportExcel(@Res() res: Response) {
    const buffer = await this.stockExport.buildExport();
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="existencias.xlsx"',
    });
    res.send(buffer);
  }

  @Get()
  @ApiOperation({ summary: "Lista existencias por variante y almacén (paginado, filtro por categoría/marca/almacén/búsqueda)." })
  findAll(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("almacenId") almacenId?: string,
    @Query("search") search?: string,
    @Query("categoryId") categoryId?: string,
    @Query("brandId") brandId?: string,
  ) {
    return this.stock.findAll({ page, pageSize, almacenId, search, categoryId, brandId });
  }

  @Get("lotes")
  @ApiOperation({ summary: "Historial de lotes de compra (paginado, filtro por variante/almacén/estado)." })
  findLotes(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("varianteId") varianteId?: string,
    @Query("almacenId") almacenId?: string,
    @Query("estado") estado?: "disponible" | "agotado",
  ) {
    return this.stock.findLotes({ page, pageSize, varianteId, almacenId, estado });
  }
}
