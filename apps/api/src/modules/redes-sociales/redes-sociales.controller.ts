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
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { RedesSocialesService } from "./redes-sociales.service";
import { CreateRedSocialDto } from "./dto/create-red-social.dto";
import { UpdateRedSocialDto } from "./dto/update-red-social.dto";
import { redSocialLogoMulterOptions } from "./red-social-logo.multer";

@ApiTags("redes-sociales")
@ApiBearerAuth()
@Controller("redes-sociales")
export class RedesSocialesController {
  constructor(private readonly redesSociales: RedesSocialesService) {}

  // Público: el footer del sitio lo usa para pintar los íconos de "Seguinos".
  @Public()
  @Get()
  @ApiOperation({ summary: "Lista las redes sociales del footer." })
  findAll() {
    return this.redesSociales.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtiene una red social por id." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.redesSociales.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Crea una red social." })
  create(@Body() dto: CreateRedSocialDto) {
    return this.redesSociales.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualiza una red social." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateRedSocialDto) {
    return this.redesSociales.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Elimina la ficha completa de la red social." })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.redesSociales.remove(id);
  }

  @Post(":id/logo")
  @UseInterceptors(FileInterceptor("file", redSocialLogoMulterOptions))
  @ApiOperation({ summary: "Sube el logo de la red social (JPEG/PNG/WEBP/GIF, hasta 5MB)." })
  uploadLogo(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    // Con diskStorage no hay file.buffer para que Nest valide el tipo por contenido;
    // el filtro de tipo ya corrió en multer (red-social-logo.multer.ts) antes de guardar en disco.
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.redesSociales.setLogo(id, file);
  }
}
