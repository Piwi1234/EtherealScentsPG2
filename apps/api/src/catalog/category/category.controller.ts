import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../modules/auth/decorators/public.decorator";
import { CategoryService } from "./category.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { categoryImageMulterOptions } from "./category-image.multer";

@ApiTags("categories")
@Controller("categories")
export class CategoryController {
  constructor(private readonly categories: CategoryService) {}

  // Lectura pública: el catálogo público (storefront) reusa este listado para su filtro de categorías.
  @Public()
  @Get()
  findAll(@Query("tree", new ParseBoolPipe({ optional: true })) tree?: boolean) {
    return this.categories.findAll({ tree });
  }

  @Public()
  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.categories.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.categories.remove(id);
  }

  @Post(":id/image")
  @UseInterceptors(FileInterceptor("file", categoryImageMulterOptions))
  uploadImage(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    // Con diskStorage no hay file.buffer para que Nest valide el tipo por contenido;
    // el filtro de tipo ya corrió en multer (category-image.multer.ts) antes de guardar en disco.
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.categories.setImage(id, file);
  }
}
