import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { EmpresasService } from "./empresas.service";
import { CreateEmpresaDto } from "./dto/create-empresa.dto";
import { UpdateEmpresaDto } from "./dto/update-empresa.dto";

@ApiTags("empresas")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("empresas")
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}

  @Get()
  @ApiOperation({ summary: "Lista empresas (paginado)." })
  findAll(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.empresas.findAll({ page, pageSize });
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtiene una empresa por id." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.empresas.findOne(id);
  }

  @Post()
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Crea una empresa (casa matriz o sucursal). Solo ADMIN." })
  create(@Body() dto: CreateEmpresaDto) {
    return this.empresas.create(dto);
  }

  @Patch(":id")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Actualiza una empresa. Solo ADMIN." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateEmpresaDto) {
    return this.empresas.update(id, dto);
  }

  @Delete(":id")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Soft delete: marca activo = false. Solo ADMIN." })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.empresas.remove(id);
  }
}
