import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { NaturalezaMovimiento, Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { TipoMovimientoService } from "./tipo-movimiento.service";
import { CreateTipoMovimientoDto } from "./dto/create-tipo-movimiento.dto";
import { UpdateTipoMovimientoDto } from "./dto/update-tipo-movimiento.dto";

@ApiTags("contabilidad")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("contabilidad")
export class TipoMovimientoController {
  constructor(private readonly tipos: TipoMovimientoService) {}

  @Get("tipos")
  @ApiOperation({ summary: "Lista todos los tipos de ingreso/gasto de todas las carteras." })
  findAllGlobal(
    @Query("carteraId") carteraId?: string,
    @Query("naturaleza") naturaleza?: NaturalezaMovimiento,
    @Query("activo") activo?: string,
  ) {
    return this.tipos.findAllGlobal({ carteraId, naturaleza, activo });
  }

  @Get("carteras/:carteraId/tipos")
  @ApiOperation({ summary: "Lista los tipos de ingreso/gasto propios de una cartera." })
  findAll(
    @Param("carteraId", ParseUUIDPipe) carteraId: string,
    @Query("naturaleza") naturaleza?: NaturalezaMovimiento,
    @Query("activo") activo?: string,
  ) {
    return this.tipos.findAll(carteraId, { naturaleza, activo });
  }

  @Post("carteras/:carteraId/tipos")
  @ApiOperation({ summary: "Crea un tipo de ingreso/gasto para una cartera." })
  create(@Param("carteraId", ParseUUIDPipe) carteraId: string, @Body() dto: CreateTipoMovimientoDto) {
    return this.tipos.create(carteraId, dto);
  }

  @Patch("tipos/:id")
  @ApiOperation({ summary: "Renombra o desactiva un tipo de movimiento." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateTipoMovimientoDto) {
    return this.tipos.update(id, dto);
  }
}
