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
import { Roles } from "../../modules/auth/decorators/roles.decorator";
import { Public } from "../../modules/auth/decorators/public.decorator";
import { WebpUploadInterceptor } from "../../common/webp-upload.interceptor";
import { ComboService } from "./combo.service";
import { comboImageMulterOptions } from "./combo-image.multer";
import { CreateComboDto, UpdateComboDto } from "./dto/combo.dto";

/** Gestión de combos (Inventario → Combos). */
@ApiTags("combos")
@ApiBearerAuth()
@Roles(Rol.ADMIN, Rol.SELLER)
@Controller("combos")
export class ComboController {
  constructor(private readonly combos: ComboService) {}

  @Get()
  @ApiOperation({ summary: "Combos con su precio en vivo, ahorro y stock de cada componente." })
  findAll(@Query("categoryId") categoryId?: string, @Query("search") search?: string) {
    return this.combos.findAll({ categoryId, search });
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.combos.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Crea un combo de 2 a 4 productos de una misma categoría, con un descuento fijo en Bs." })
  create(@Body() dto: CreateComboDto) {
    return this.combos.create(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateComboDto) {
    return this.combos.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.combos.remove(id);
  }

  @Post(":id/image")
  @UseInterceptors(FileInterceptor("file", comboImageMulterOptions), WebpUploadInterceptor)
  uploadImage(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    return this.combos.setImage(id, file);
  }
}

/** Combos publicados para la web pública: solo lectura, sin autenticación y sin cantidades de stock. */
@Public()
@ApiTags("catalog")
@Controller("catalog/combos")
export class ComboPublicController {
  constructor(private readonly combos: ComboService) {}

  @Get()
  findAll(@Query("categoryId") categoryId?: string) {
    return this.combos.findPublic({ categoryId });
  }

  @Get(":slug")
  findOne(@Param("slug") slug: string) {
    return this.combos.findPublicBySlug(slug);
  }
}
