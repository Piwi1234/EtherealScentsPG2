import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { ClientesService } from "./clientes.service";
import { CreateClienteDto } from "./dto/create-cliente.dto";
import { UpdateClienteDto } from "./dto/update-cliente.dto";
import { QueryClienteDto } from "./dto/query-cliente.dto";

@ApiTags("clientes")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("clientes")
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  @ApiOperation({ summary: "Lista clientes (paginado, busca por nombre/numeroDocumento/email)." })
  findAll(@Query() query: QueryClienteDto) {
    return this.clientes.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtiene un cliente por id." })
  @ApiResponse({ status: 404, description: "Cliente no encontrado." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.clientes.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Registra un cliente manualmente desde gestión (origen = MANUAL)." })
  @ApiResponse({ status: 409, description: "Ya existe un cliente con ese número de documento o email." })
  create(@Body() dto: CreateClienteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.clientes.create(dto, user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualiza un cliente." })
  @ApiResponse({ status: 409, description: "Ya existe otro cliente con ese número de documento o email." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateClienteDto) {
    return this.clientes.update(id, dto);
  }

  @Delete(":id")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Soft delete: marca activo = false. Nunca borra el registro. Solo ADMIN." })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.clientes.remove(id);
  }
}
