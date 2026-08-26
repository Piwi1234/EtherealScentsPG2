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
import { MoveCarouselImageDto } from "../carousel-image/dto/move-carousel-image.dto";
import { UpdateCarouselImageUrlDto } from "../carousel-image/dto/update-carousel-image-url.dto";
import { UpdateCarouselImageTitulosDto } from "../carousel-image/dto/update-carousel-image-titulos.dto";
import { carouselImageMulterOptions } from "../carousel-image/carousel-image.multer";

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

  // Antes de ":id" en la lectura del código por claridad, aunque no colisiona en el routing
  // (":id" solo matchea un segmento, "slug/:slug" son dos) — usado por /categoria/[slug] público.
  @Public()
  @Get("slug/:slug")
  findBySlug(@Param("slug") slug: string) {
    return this.categories.findBySlug(slug);
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

  // "Producto destacado" del home (bloque cuadrado).
  @Get(":id/carousel-images")
  listCarouselImages(@Param("id", ParseUUIDPipe) id: string) {
    return this.categories.listCarouselImages(id, "FEATURE");
  }

  @Post(":id/carousel-images")
  @UseInterceptors(FileInterceptor("file", carouselImageMulterOptions))
  addCarouselImage(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    // Con diskStorage no hay file.buffer para que Nest valide el tipo por contenido;
    // el filtro de tipo ya corrió en multer (carousel-image.multer.ts) antes de guardar en disco.
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.categories.addCarouselImage(id, "FEATURE", file);
  }

  @Delete(":id/carousel-images/:imageId")
  removeCarouselImage(@Param("id", ParseUUIDPipe) id: string, @Param("imageId", ParseUUIDPipe) imageId: string) {
    return this.categories.removeCarouselImage(id, imageId);
  }

  @Patch(":id/carousel-images/:imageId/move")
  moveCarouselImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @Body() dto: MoveCarouselImageDto,
  ) {
    return this.categories.moveCarouselImage(id, imageId, dto.direction);
  }

  @Patch(":id/carousel-images/:imageId/url")
  setCarouselImageUrl(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateCarouselImageUrlDto,
  ) {
    return this.categories.setCarouselImageUrl(id, imageId, dto.url ?? null);
  }

  @Patch(":id/carousel-images/:imageId/titulos")
  setCarouselImageTitulos(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateCarouselImageTitulosDto,
  ) {
    return this.categories.setCarouselImageTitulos(id, imageId, dto.titulo1 ?? null, dto.titulo2 ?? null);
  }

  // Hero de /categoria/[id] (panorámico) — carrusel independiente del de arriba, compartido con
  // todas las subcategorías de esta raíz.
  @Get(":id/hero-carousel-images")
  listHeroCarouselImages(@Param("id", ParseUUIDPipe) id: string) {
    return this.categories.listCarouselImages(id, "CATEGORY_HERO");
  }

  @Post(":id/hero-carousel-images")
  @UseInterceptors(FileInterceptor("file", carouselImageMulterOptions))
  addHeroCarouselImage(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.categories.addCarouselImage(id, "CATEGORY_HERO", file);
  }

  @Delete(":id/hero-carousel-images/:imageId")
  removeHeroCarouselImage(@Param("id", ParseUUIDPipe) id: string, @Param("imageId", ParseUUIDPipe) imageId: string) {
    return this.categories.removeCarouselImage(id, imageId);
  }

  @Patch(":id/hero-carousel-images/:imageId/move")
  moveHeroCarouselImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @Body() dto: MoveCarouselImageDto,
  ) {
    return this.categories.moveCarouselImage(id, imageId, dto.direction);
  }

  @Patch(":id/hero-carousel-images/:imageId/url")
  setHeroCarouselImageUrl(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateCarouselImageUrlDto,
  ) {
    return this.categories.setCarouselImageUrl(id, imageId, dto.url ?? null);
  }
}
