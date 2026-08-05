import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { ZonaCoberturaService } from "./zona-cobertura.service";
import { CreateZonaCoberturaDto } from "./dto/create-zona-cobertura.dto";
import { UpdateZonaCoberturaDto } from "./dto/update-zona-cobertura.dto";

@ApiTags("zonas-cobertura")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("zonas-cobertura")
export class ZonaCoberturaController {
  constructor(private readonly zonas: ZonaCoberturaService) {}

  @Get()
  @ApiOperation({ summary: "Lista zonas de cobertura, ordenadas por prioridad. Filtro opcional por ciudad." })
  findAll(@Query("ciudadId") ciudadId?: string) {
    return this.zonas.findAll(ciudadId);
  }

  @Post()
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Asigna un almacén a una ciudad con una prioridad de cercanía. Solo ADMIN." })
  create(@Body() dto: CreateZonaCoberturaDto) {
    return this.zonas.create(dto);
  }

  @Patch(":ciudadId/:almacenId")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Actualiza la prioridad de una zona de cobertura. Solo ADMIN." })
  update(
    @Param("ciudadId", ParseUUIDPipe) ciudadId: string,
    @Param("almacenId", ParseUUIDPipe) almacenId: string,
    @Body() dto: UpdateZonaCoberturaDto,
  ) {
    return this.zonas.update(ciudadId, almacenId, dto);
  }

  @Delete(":ciudadId/:almacenId")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Quita un almacén de la cobertura de una ciudad. Solo ADMIN." })
  remove(@Param("ciudadId", ParseUUIDPipe) ciudadId: string, @Param("almacenId", ParseUUIDPipe) almacenId: string) {
    return this.zonas.remove(ciudadId, almacenId);
  }
}
