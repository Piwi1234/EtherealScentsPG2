import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { UsuariosService } from "./usuarios.service";
import { CreateUsuarioDto } from "./dto/create-usuario.dto";
import { UpdateUsuarioDto } from "./dto/update-usuario.dto";

@ApiTags("usuarios")
@ApiBearerAuth()
@Roles(Rol.ADMIN)
@Controller("usuarios")
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: "Lista usuarios internos (paginado). Solo ADMIN." })
  findAll(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.usuarios.findAll({ page, pageSize });
  }

  @Post()
  @ApiOperation({ summary: "Crea un usuario interno (ADMIN o SELLER). Solo ADMIN. Sin registro público." })
  @ApiResponse({ status: 201, description: "Usuario creado (sin passwordHash)." })
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuarios.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualiza un usuario interno. Solo ADMIN." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateUsuarioDto) {
    return this.usuarios.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft delete: marca activo = false. Nunca borra el registro. Solo ADMIN." })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.usuarios.remove(id);
  }
}
