import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { ProveedoresService } from "./proveedores.service";
import { CreateProveedorDto } from "./dto/create-proveedor.dto";
import { UpdateProveedorDto } from "./dto/update-proveedor.dto";

@ApiTags("proveedores")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("proveedores")
export class ProveedoresController {
  constructor(private readonly proveedores: ProveedoresService) {}

  @Get()
  @ApiOperation({ summary: "Lista proveedores (paginado)." })
  findAll(@Query("page") page?: string, @Query("pageSize") pageSize?: string, @Query("activo") activo?: string) {
    return this.proveedores.findAll({ page, pageSize, activo });
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtiene un proveedor por id." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.proveedores.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Crea un proveedor." })
  create(@Body() dto: CreateProveedorDto) {
    return this.proveedores.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualiza un proveedor." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateProveedorDto) {
    return this.proveedores.update(id, dto);
  }

  @Delete(":id")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Soft delete: marca activo = false. Solo ADMIN." })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.proveedores.remove(id);
  }
}
