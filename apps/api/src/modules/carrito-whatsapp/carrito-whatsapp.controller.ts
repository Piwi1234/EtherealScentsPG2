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
import { CarritoWhatsappService } from "./carrito-whatsapp.service";
import { CreateCarritoWhatsappContactoDto } from "./dto/create-carrito-whatsapp-contacto.dto";
import { UpdateCarritoWhatsappContactoDto } from "./dto/update-carrito-whatsapp-contacto.dto";
import { carritoWhatsappImagenMulterOptions } from "./carrito-whatsapp-imagen.multer";

@ApiTags("carrito-whatsapp")
@ApiBearerAuth()
@Controller("carrito-whatsapp")
export class CarritoWhatsappController {
  constructor(private readonly contactos: CarritoWhatsappService) {}

  // Público: el carrito del sitio lo usa para dejar elegir a quién enviarle la cotización.
  @Public()
  @Get()
  @ApiOperation({ summary: "Lista los contactos de WhatsApp del carrito." })
  findAll() {
    return this.contactos.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtiene un contacto por id." })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.contactos.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Crea un contacto." })
  create(@Body() dto: CreateCarritoWhatsappContactoDto) {
    return this.contactos.create(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualiza un contacto." })
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCarritoWhatsappContactoDto) {
    return this.contactos.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Elimina la ficha completa del contacto." })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.contactos.remove(id);
  }

  @Post(":id/imagen")
  @UseInterceptors(FileInterceptor("file", carritoWhatsappImagenMulterOptions))
  @ApiOperation({ summary: "Sube la imagen del contacto (JPEG/PNG/WEBP/GIF, hasta 5MB)." })
  uploadImagen(@Param("id", ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    // Con diskStorage no hay file.buffer para que Nest valide el tipo por contenido;
    // el filtro de tipo ya corrió en multer (carrito-whatsapp-imagen.multer.ts) antes de guardar en disco.
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.contactos.setImagen(id, file);
  }
}
