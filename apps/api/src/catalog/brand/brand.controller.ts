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
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { BrandService } from "./brand.service";
import { BrandImportService } from "./brand-import.service";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";
import { brandLogoMulterOptions } from "./brand-logo.multer";
import { brandImportMulterOptions } from "./brand-import.multer";

@ApiTags("brands")
@Controller("brands")
export class BrandController {
  constructor(
    private readonly brands: BrandService,
    private readonly brandImport: BrandImportService,
  ) {}

  @Get()
  findAll(@Query("categoryId") categoryId?: string) {
    return this.brands.findAll({ categoryId });
  }

  // Antes de ":id" — "import" no es un uuid, pero se declara primero para que quede a la vista
  // junto al resto de rutas fijas.
  @Get("import/template")
  async downloadImportTemplate(@Res() res: Response) {
    const buffer = await this.brandImport.buildTemplate();
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-importacion-marcas.xlsx"',
    });
    res.send(buffer);
  }

  @Post("import")
  @UseInterceptors(FileInterceptor("file", brandImportMulterOptions))
  importBrands(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser un Excel (.xlsx) de hasta 5MB.");
    }
    return this.brandImport.importFromFile(file.buffer);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.brands.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBrandDto) {
    return this.brands.create(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateBrandDto) {
    return this.brands.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.brands.remove(id);
  }

  @Post(":id/logo")
  @UseInterceptors(FileInterceptor("file", brandLogoMulterOptions))
  uploadLogo(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    // Con diskStorage no hay file.buffer para que Nest valide el tipo por contenido;
    // el filtro de tipo ya corrió en multer (brand-logo.multer.ts) antes de guardar en disco.
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.brands.setLogo(id, file);
  }
}
