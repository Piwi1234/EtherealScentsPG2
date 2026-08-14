import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { MonedaCartera, Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { CarteraService } from "./cartera.service";
import { CreateCarteraDto } from "./dto/create-cartera.dto";
import { UpdateCarteraDto } from "./dto/update-cartera.dto";

@ApiTags("contabilidad")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("contabilidad/carteras")
export class CarteraController {
  constructor(private readonly carteras: CarteraService) {}

  @Get()
  @ApiOperation({ summary: "Lista carteras, filtro por moneda/activo." })
  findAll(@Query("moneda") moneda?: MonedaCartera, @Query("activo") activo?: string) {
    return this.carteras.findAll({ moneda, activo });
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtiene una cartera por id." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.carteras.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Crea una cartera dentro de una moneda." })
  create(@Body() dto: CreateCarteraDto) {
    return this.carteras.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Renombra o reactiva una cartera." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCarteraDto) {
    return this.carteras.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft delete: marca activo = false." })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.carteras.remove(id);
  }
}
