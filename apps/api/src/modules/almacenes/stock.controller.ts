import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { StockService } from "./stock.service";

@ApiTags("stock")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("stock")
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  @ApiOperation({ summary: "Lista existencias por variante y almacén (paginado, filtro por almacén y búsqueda)." })
  findAll(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("almacenId") almacenId?: string,
    @Query("search") search?: string,
  ) {
    return this.stock.findAll({ page, pageSize, almacenId, search });
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
