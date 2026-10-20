import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { ClientesService } from "./clientes.service";
import { ClientesImportService } from "./clientes-import.service";
import { clientesImportMulterOptions } from "./clientes-import.multer";
import { CreateClienteDto } from "./dto/create-cliente.dto";
import { UpdateClienteDto } from "./dto/update-cliente.dto";
import { QueryClienteDto } from "./dto/query-cliente.dto";
import { QueryPagosClienteDto } from "./dto/query-pagos-cliente.dto";

@ApiTags("clientes")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("clientes")
export class ClientesController {
  constructor(
    private readonly clientes: ClientesService,
    private readonly clientesImport: ClientesImportService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Lista clientes (paginado, busca por nombre/email)." })
  findAll(@Query() query: QueryClienteDto) {
    return this.clientes.findAll(query);
  }

  // Antes de ":id" — "import" no es un uuid, pero se declara primero para que quede a la vista
  // junto al resto de rutas fijas (mismo motivo que brand.controller.ts).
  @Get("import/template")
  @ApiOperation({ summary: "Descarga la plantilla .xlsx para importar clientes en lote." })
  async downloadImportTemplate(@Res() res: Response) {
    const buffer = await this.clientesImport.buildTemplate();
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-importacion-clientes.xlsx"',
    });
    res.send(buffer);
  }

  @Post("import")
  @ApiOperation({ summary: "Importa clientes en lote desde un .xlsx (todo o nada — ver ClientesImportService)." })
  @UseInterceptors(FileInterceptor("file", clientesImportMulterOptions))
  importClientes(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser un Excel (.xlsx) de hasta 5MB.");
    }
    return this.clientesImport.importFromFile(file.buffer, user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtiene un cliente por id." })
  @ApiResponse({ status: 404, description: "Cliente no encontrado." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.clientes.findOne(id);
  }

  @Get(":id/pagos")
  @ApiOperation({ summary: "Movimientos de cartera (adelanto, cobros de Cuenta por Cobrar y reversos) ligados a las ventas de este cliente." })
  findPagos(@Param("id", ParseUUIDPipe) id: string, @Query() query: QueryPagosClienteDto) {
    return this.clientes.findPagos(id, query);
  }

  @Post()
  @ApiOperation({ summary: "Registra un cliente manualmente desde gestión (origen = MANUAL)." })
  @ApiResponse({ status: 409, description: "Ya existe un cliente con ese email." })
  create(@Body() dto: CreateClienteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.clientes.create(dto, user.id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualiza un cliente." })
  @ApiResponse({ status: 409, description: "Ya existe otro cliente con ese email." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateClienteDto) {
    return this.clientes.update(id, dto);
  }

  @Delete(":id")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Soft delete: marca activo = false. Nunca borra el registro. Solo ADMIN." })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.clientes.remove(id);
  }

  @Patch(":id/activar")
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: "Reactiva un cliente desactivado: marca activo = true. Solo ADMIN." })
  activar(@Param("id", ParseUUIDPipe) id: string) {
    return this.clientes.activar(id);
  }
}
