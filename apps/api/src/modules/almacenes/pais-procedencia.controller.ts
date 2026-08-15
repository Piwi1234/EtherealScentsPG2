import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { PaisProcedenciaService } from "./pais-procedencia.service";
import { CreatePaisProcedenciaDto } from "./dto/create-pais-procedencia.dto";
import { UpdatePaisProcedenciaDto } from "./dto/update-pais-procedencia.dto";

@ApiTags("paises-procedencia")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("paises-procedencia")
export class PaisProcedenciaController {
  constructor(private readonly paises: PaisProcedenciaService) {}

  @Get()
  @ApiOperation({ summary: "Lista países de procedencia (paginado)." })
  findAll(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.paises.findAll({ page, pageSize });
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtiene un país de procedencia por id." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.paises.findOne(id);
  }

  @Post()
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Crea un país de procedencia. Solo ADMIN." })
  create(@Body() dto: CreatePaisProcedenciaDto) {
    return this.paises.create(dto);
  }

  @Patch(":id")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Actualiza un país de procedencia. Solo ADMIN." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePaisProcedenciaDto) {
    return this.paises.update(id, dto);
  }

  @Delete(":id")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Soft delete: marca activo = false. Solo ADMIN." })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.paises.remove(id);
  }
}
