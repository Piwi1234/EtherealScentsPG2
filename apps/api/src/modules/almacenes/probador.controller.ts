import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { ProbadorService } from "./probador.service";
import { BajaProbadorDto, ConvertirProbadorDto } from "./dto/probador.dto";

@ApiTags("probadores")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("probadores")
export class ProbadorController {
  constructor(private readonly probadores: ProbadorService) {}

  @Get()
  @ApiOperation({ summary: "Probadores que hay ahora por producto y almacén (convertidos menos dados de baja)." })
  resumen(
    @Query("almacenId") almacenId?: string,
    @Query("categoryId") categoryId?: string,
    @Query("brandId") brandId?: string,
    @Query("search") search?: string,
    @Query("incluirAgotados") incluirAgotados?: string,
  ) {
    return this.probadores.resumen({ almacenId, categoryId, brandId, search, incluirAgotados });
  }

  @Get("movimientos")
  @ApiOperation({ summary: "Historial de conversiones y bajas de probadores (paginado)." })
  movimientos(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("varianteId") varianteId?: string,
    @Query("almacenId") almacenId?: string,
    @Query("tipo") tipo?: string,
  ) {
    return this.probadores.movimientos({ page, pageSize, varianteId, almacenId, tipo });
  }

  @Post("convertir")
  @ApiOperation({ summary: "Convierte stock disponible en probadores (sin venta ni ganancia); guarda el costo real de los lotes." })
  convertir(@Body() dto: ConvertirProbadorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.probadores.convertir(dto, user.id);
  }

  @Post("baja")
  @ApiOperation({ summary: "Da de baja probadores que se agotaron o se perdieron." })
  baja(@Body() dto: BajaProbadorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.probadores.baja(dto, user.id);
  }
}
