import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { CiudadProcedenciaService } from "./ciudad-procedencia.service";
import { CreateCiudadProcedenciaDto } from "./dto/create-ciudad-procedencia.dto";
import { UpdateCiudadProcedenciaDto } from "./dto/update-ciudad-procedencia.dto";

@ApiTags("ciudades-procedencia")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("ciudades-procedencia")
export class CiudadProcedenciaController {
  constructor(private readonly ciudades: CiudadProcedenciaService) {}

  @Get()
  @ApiOperation({ summary: "Lista ciudades de procedencia (paginado)." })
  findAll(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.ciudades.findAll({ page, pageSize });
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtiene una ciudad de procedencia por id." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.ciudades.findOne(id);
  }

  @Post()
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Crea una ciudad de procedencia. Solo ADMIN." })
  create(@Body() dto: CreateCiudadProcedenciaDto) {
    return this.ciudades.create(dto);
  }

  @Patch(":id")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Actualiza una ciudad de procedencia. Solo ADMIN." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCiudadProcedenciaDto) {
    return this.ciudades.update(id, dto);
  }

  @Delete(":id")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Soft delete: marca activo = false. Solo ADMIN." })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.ciudades.remove(id);
  }
}
