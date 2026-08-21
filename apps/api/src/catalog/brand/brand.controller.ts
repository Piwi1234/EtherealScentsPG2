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
import { ApiTags } from "@nestjs/swagger";
import { BrandService } from "./brand.service";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";
import { brandLogoMulterOptions } from "./brand-logo.multer";

@ApiTags("brands")
@Controller("brands")
export class BrandController {
  constructor(private readonly brands: BrandService) {}

  @Get()
  findAll(@Query("categoryId") categoryId?: string) {
    return this.brands.findAll({ categoryId });
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
