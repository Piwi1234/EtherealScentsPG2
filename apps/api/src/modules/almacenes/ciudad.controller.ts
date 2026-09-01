import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Public } from "../auth/decorators/public.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { CiudadService } from "./ciudad.service";
import { CreateCiudadDto } from "./dto/create-ciudad.dto";
import { UpdateCiudadDto } from "./dto/update-ciudad.dto";

@ApiTags("ciudades")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("ciudades")
export class CiudadController {
  constructor(private readonly ciudades: CiudadService) {}

  // Pública: el select de ciudad en el perfil de cliente (sitio público) la necesita sin estar
  // logueado como staff. @Roles() vacío pisa el @Roles(ADMIN, SELLER) de la clase (RolesGuard usa
  // reflector.getAllAndOverride, que toma el más específico) — sin esto, @Public() por sí solo no
  // alcanza: igual la bloquearía RolesGuard al no haber request.user. Declarada antes de ":id" para
  // que no la intercepte esa ruta.
  @Public()
  @Roles()
  @Get("publicas")
  @ApiOperation({ summary: "Lista ciudades activas (id + nombre) para selects públicos. Sin auth." })
  findAllPublic() {
    return this.ciudades.findAllPublic();
  }

  @Get()
  @ApiOperation({ summary: "Lista ciudades (paginado)." })
  findAll(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.ciudades.findAll({ page, pageSize });
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtiene una ciudad por id." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.ciudades.findOne(id);
  }

  @Post()
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Crea una ciudad. Solo ADMIN." })
  create(@Body() dto: CreateCiudadDto) {
    return this.ciudades.create(dto);
  }

  @Patch(":id")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Actualiza una ciudad. Solo ADMIN." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCiudadDto) {
    return this.ciudades.update(id, dto);
  }

  @Delete(":id")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Elimina una ciudad. Bloqueado si tiene clientes o proformas asociadas. Solo ADMIN." })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.ciudades.remove(id);
  }
}
