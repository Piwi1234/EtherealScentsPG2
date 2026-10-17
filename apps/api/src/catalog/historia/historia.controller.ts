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
import { HistoriaCategoria } from "@app/database";
import { Public } from "../../modules/auth/decorators/public.decorator";
import { WebpUploadInterceptor } from "../../common/webp-upload.interceptor";
import { historiaBloqueImageMulterOptions } from "./historia-bloque.multer";
import { HistoriaService } from "./historia.service";
import { CreateHistoriaDto } from "./dto/create-historia.dto";
import { UpdateHistoriaDto } from "./dto/update-historia.dto";
import { UpdateHistoriaBloqueDto } from "./dto/update-historia-bloque.dto";
import { AddRelacionadaDto } from "./dto/add-relacionada.dto";
import { UpdateHistoriaSugerenciaDto } from "./dto/update-historia-sugerencia.dto";
import { AddSugerenciaProductoDto } from "./dto/add-sugerencia-producto.dto";
import { MoveCarouselImageDto } from "../carousel-image/dto/move-carousel-image.dto";

@ApiTags("historias")
@Controller("historias")
export class HistoriaController {
  constructor(private readonly historias: HistoriaService) {}

  @Public()
  @Get()
  findAllPublic(@Query("categoria") categoria?: HistoriaCategoria, @Query("search") search?: string) {
    return this.historias.findAllPublic({ categoria, search });
  }

  @Public()
  @Get("destacada")
  findDestacada() {
    return this.historias.findDestacada();
  }

  @Public()
  @Get("slug/:slug")
  findBySlug(@Param("slug") slug: string) {
    return this.historias.findBySlug(slug);
  }

  @Get("admin")
  findAllAdmin() {
    return this.historias.findAllAdmin();
  }

  @Delete("destacada")
  clearDestacada() {
    return this.historias.clearDestacada();
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.historias.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateHistoriaDto) {
    return this.historias.create(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateHistoriaDto) {
    return this.historias.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.historias.remove(id);
  }

  @Patch(":id/move")
  move(@Param("id", ParseUUIDPipe) id: string, @Body() dto: MoveCarouselImageDto) {
    return this.historias.move(id, dto.direction);
  }

  @Patch(":id/destacada")
  setDestacada(@Param("id", ParseUUIDPipe) id: string) {
    return this.historias.setDestacada(id);
  }

  // ---------------------------------------------------------------------------------------------
  // Bloques
  // ---------------------------------------------------------------------------------------------

  @Post(":id/bloques")
  addBloque(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateHistoriaBloqueDto) {
    return this.historias.addBloque(id, dto);
  }

  @Patch(":id/bloques/:bloqueId")
  updateBloque(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("bloqueId", ParseUUIDPipe) bloqueId: string,
    @Body() dto: UpdateHistoriaBloqueDto,
  ) {
    return this.historias.updateBloque(id, bloqueId, dto);
  }

  @Delete(":id/bloques/:bloqueId")
  removeBloque(@Param("id", ParseUUIDPipe) id: string, @Param("bloqueId", ParseUUIDPipe) bloqueId: string) {
    return this.historias.removeBloque(id, bloqueId);
  }

  @Patch(":id/bloques/:bloqueId/move")
  moveBloque(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("bloqueId", ParseUUIDPipe) bloqueId: string,
    @Body() dto: MoveCarouselImageDto,
  ) {
    return this.historias.moveBloque(id, bloqueId, dto.direction);
  }

  @Post(":id/bloques/:bloqueId/image")
  @UseInterceptors(FileInterceptor("file", historiaBloqueImageMulterOptions), WebpUploadInterceptor)
  setBloqueImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("bloqueId", ParseUUIDPipe) bloqueId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.historias.setBloqueImage(id, bloqueId, file);
  }

  // Variante de esta misma imagen para pantallas chicas — ver HistoriaService.setBloqueMobileImage.
  @Post(":id/bloques/:bloqueId/mobile-image")
  @UseInterceptors(FileInterceptor("file", historiaBloqueImageMulterOptions), WebpUploadInterceptor)
  setBloqueMobileImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("bloqueId", ParseUUIDPipe) bloqueId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.historias.setBloqueMobileImage(id, bloqueId, file);
  }

  @Delete(":id/bloques/:bloqueId/mobile-image")
  removeBloqueMobileImage(@Param("id", ParseUUIDPipe) id: string, @Param("bloqueId", ParseUUIDPipe) bloqueId: string) {
    return this.historias.removeBloqueMobileImage(id, bloqueId);
  }

  // ---------------------------------------------------------------------------------------------
  // Relacionadas
  // ---------------------------------------------------------------------------------------------

  @Post(":id/relacionadas")
  addRelacionada(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AddRelacionadaDto) {
    return this.historias.addRelacionada(id, dto.relacionadaId);
  }

  @Delete(":id/relacionadas/:relacionadaId")
  removeRelacionada(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("relacionadaId", ParseUUIDPipe) relacionadaId: string,
  ) {
    return this.historias.removeRelacionada(id, relacionadaId);
  }

  // ---------------------------------------------------------------------------------------------
  // Sugerencia al final de la historia
  // ---------------------------------------------------------------------------------------------

  @Patch(":id/sugerencia")
  setSugerencia(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateHistoriaSugerenciaDto) {
    return this.historias.setSugerencia(id, dto);
  }

  @Post(":id/sugerencia/productos")
  addSugerenciaProducto(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AddSugerenciaProductoDto) {
    return this.historias.addSugerenciaProducto(id, dto.productId);
  }

  @Delete(":id/sugerencia/productos/:productId")
  removeSugerenciaProducto(@Param("id", ParseUUIDPipe) id: string, @Param("productId", ParseUUIDPipe) productId: string) {
    return this.historias.removeSugerenciaProducto(id, productId);
  }

  @Patch(":id/sugerencia/productos/:productId/move")
  moveSugerenciaProducto(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: MoveCarouselImageDto,
  ) {
    return this.historias.moveSugerenciaProducto(id, productId, dto.direction);
  }
}
