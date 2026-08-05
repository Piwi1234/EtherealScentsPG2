import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { AlmacenService } from "./almacen.service";
import { CreateAlmacenDto } from "./dto/create-almacen.dto";
import { UpdateAlmacenDto } from "./dto/update-almacen.dto";

@ApiTags("almacenes")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("almacenes")
export class AlmacenController {
  constructor(private readonly almacenes: AlmacenService) {}

  @Get()
  @ApiOperation({ summary: "Lista almacenes (paginado, filtro opcional por ciudad)." })
  findAll(@Query("page") page?: string, @Query("pageSize") pageSize?: string, @Query("ciudadId") ciudadId?: string) {
    return this.almacenes.findAll({ page, pageSize, ciudadId });
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtiene un almacén por id." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.almacenes.findOne(id);
  }

  @Post()
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Crea un almacén. Solo ADMIN." })
  create(@Body() dto: CreateAlmacenDto) {
    return this.almacenes.create(dto);
  }

  @Patch(":id")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Actualiza un almacén. Solo ADMIN." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateAlmacenDto) {
    return this.almacenes.update(id, dto);
  }

  @Delete(":id")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Soft delete: marca activo = false. Bloqueado si tiene stock o proformas activas. Solo ADMIN." })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.almacenes.remove(id);
  }
}
