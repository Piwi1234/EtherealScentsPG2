import { BadRequestException, Body, Controller, Get, Post, Put, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../modules/auth/decorators/public.decorator";
import { SettingsService } from "./settings.service";
import { UpdateExchangeRateDto } from "./dto/update-exchange-rate.dto";
import { landingImageMulterOptions } from "./landing-image.multer";

@ApiTags("settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get("exchange-rate")
  async getExchangeRate() {
    return { exchangeRate: await this.settings.getExchangeRate() };
  }

  @Put("exchange-rate")
  async setExchangeRate(@Body() dto: UpdateExchangeRateDto) {
    return { exchangeRate: await this.settings.setExchangeRate(dto.exchangeRate) };
  }

  // Público (sin auth): el home lo usa para pintar las secciones "Propuesta de valor" y "Sobre
  // nosotros" — sin login, como el resto del catálogo público.
  @Public()
  @Get("landing-images")
  getLandingImages() {
    return this.settings.getLandingImages();
  }

  @Post("landing-images/hero")
  @UseInterceptors(FileInterceptor("file", landingImageMulterOptions("hero")))
  uploadHeroImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.settings.setHeroImage(file);
  }

  @Post("landing-images/value")
  @UseInterceptors(FileInterceptor("file", landingImageMulterOptions("value")))
  uploadValueImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.settings.setValueImage(file);
  }

  @Post("landing-images/about")
  @UseInterceptors(FileInterceptor("file", landingImageMulterOptions("about")))
  uploadAboutImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.settings.setAboutImage(file);
  }
}
