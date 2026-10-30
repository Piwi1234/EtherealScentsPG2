import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { DecantService } from "./decant.service";
import { BajaMlDto, ConvertirDecantDto } from "./dto/decant.dto";

@ApiTags("decants")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("decants")
export class DecantController {
  constructor(private readonly decants: DecantService) {}

  @Get()
  @ApiOperation({ summary: "ml que hay ahora en cada variante Decants y almacén." })
  resumen(@Query("almacenId") almacenId?: string, @Query("search") search?: string) {
    return this.decants.resumen({ almacenId, search });
  }

  @Get("costo-ml")
  @ApiOperation({ summary: "Costo promedio por ml (Bs) de los ml que hay en una variante Decants." })
  costoMl(@Query("varianteId", ParseUUIDPipe) varianteId: string) {
    return this.decants.costoPromedioMl(varianteId);
  }

  @Get("destinos")
  @ApiOperation({ summary: "Variantes Decants (ML) del producto de un frasco: a dónde se pueden convertir sus ml." })
  destinos(@Query("varianteOrigenId", ParseUUIDPipe) varianteOrigenId: string) {
    return this.decants.destinos(varianteOrigenId);
  }

  @Get("movimientos")
  @ApiOperation({ summary: "Historial de conversiones y bajas de ml (paginado)." })
  movimientos(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("almacenId") almacenId?: string,
    @Query("tipo") tipo?: string,
  ) {
    return this.decants.movimientos({ page, pageSize, almacenId, tipo });
  }

  @Post("convertir")
  @ApiOperation({ summary: "Convierte frascos del stock en ml de la variante Decants, heredando el costo real del lote." })
  convertir(@Body() dto: ConvertirDecantDto, @CurrentUser() user: AuthenticatedUser) {
    return this.decants.convertir(dto, user.id);
  }

  @Post("baja")
  @ApiOperation({ summary: "Da de baja ml perdidos (derrame, merma) de una variante Decants." })
  baja(@Body() dto: BajaMlDto, @CurrentUser() user: AuthenticatedUser) {
    return this.decants.baja(dto, user.id);
  }

  @Post("movimientos/:id/deshacer")
  @ApiOperation({ summary: "Deshace una conversión mientras sus ml sigan intactos." })
  deshacer(@Param("id", ParseUUIDPipe) id: string) {
    return this.decants.deshacer(id);
  }
}
