import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { EmpresasService } from "./empresas.service";
import { CreateEmpresaDto } from "./dto/create-empresa.dto";
import { UpdateEmpresaDto } from "./dto/update-empresa.dto";
import { empresaLogoMulterOptions } from "./empresa-logo.multer";

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

  // Antes de ":id" a propósito: si no, ":id" la capturaría como un uuid inválido.
  @Public()
  @Roles()
  @Get("casa-matriz-logo")
  @ApiOperation({ summary: "Nombre/logo de la empresa casa matriz — público, lo usa la página de login." })
  getCasaMatrizLogo() {
    return this.empresas.getCasaMatrizLogo();
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

  @Post(":id/logo")
  @Roles(Rol.ADMIN)
  @UseInterceptors(FileInterceptor("file", empresaLogoMulterOptions))
  @ApiOperation({ summary: "Sube el logo de la empresa (JPEG/PNG/WEBP/GIF, hasta 5MB). Solo ADMIN." })
  uploadLogo(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    // Con diskStorage no hay file.buffer para que Nest valide el tipo por contenido;
    // el filtro de tipo ya corrió en multer (empresa-logo.multer.ts) antes de guardar en disco.
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.empresas.setLogo(id, file);
  }
}
