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
  Put,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../modules/auth/decorators/public.decorator";
import { SettingsService } from "./settings.service";
import { UpdateExchangeRateDto } from "./dto/update-exchange-rate.dto";
import { UpdateWeeklyCollectionBrandDto } from "./dto/update-weekly-collection-brand.dto";
import { UpdateContactoInfoDto } from "./dto/update-contacto-info.dto";
import { landingImageMulterOptions } from "./landing-image.multer";
import { MoveCarouselImageDto } from "../catalog/carousel-image/dto/move-carousel-image.dto";
import { UpdateCarouselImageUrlDto } from "../catalog/carousel-image/dto/update-carousel-image-url.dto";
import { carouselImageMulterOptions } from "../catalog/carousel-image/carousel-image.multer";

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

  // Público (sin auth): el footer del sitio lo usa para pintar el bloque "Contacto".
  @Public()
  @Get("contacto-info")
  getContactoInfo() {
    return this.settings.getContactoInfo();
  }

  @Put("contacto-info")
  setContactoInfo(@Body() dto: UpdateContactoInfoDto) {
    return this.settings.setContactoInfo(dto);
  }

  @Get("landing-images/hero-carousel")
  listHeroCarouselImages() {
    return this.settings.listHeroCarouselImages();
  }

  @Post("landing-images/hero-carousel")
  @UseInterceptors(FileInterceptor("file", carouselImageMulterOptions))
  addHeroCarouselImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.settings.addHeroCarouselImage(file);
  }

  @Delete("landing-images/hero-carousel/:imageId")
  removeHeroCarouselImage(@Param("imageId", ParseUUIDPipe) imageId: string) {
    return this.settings.removeHeroCarouselImage(imageId);
  }

  @Patch("landing-images/hero-carousel/:imageId/move")
  moveHeroCarouselImage(@Param("imageId", ParseUUIDPipe) imageId: string, @Body() dto: MoveCarouselImageDto) {
    return this.settings.moveHeroCarouselImage(imageId, dto.direction);
  }

  @Patch("landing-images/hero-carousel/:imageId/url")
  setHeroCarouselImageUrl(@Param("imageId", ParseUUIDPipe) imageId: string, @Body() dto: UpdateCarouselImageUrlDto) {
    return this.settings.setHeroCarouselImageUrl(imageId, dto.url ?? null);
  }

  @Get("landing-images/marcas-hero-carousel")
  listMarcasHeroCarouselImages() {
    return this.settings.listMarcasHeroCarouselImages();
  }

  @Post("landing-images/marcas-hero-carousel")
  @UseInterceptors(FileInterceptor("file", carouselImageMulterOptions))
  addMarcasHeroCarouselImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.settings.addMarcasHeroCarouselImage(file);
  }

  @Delete("landing-images/marcas-hero-carousel/:imageId")
  removeMarcasHeroCarouselImage(@Param("imageId", ParseUUIDPipe) imageId: string) {
    return this.settings.removeMarcasHeroCarouselImage(imageId);
  }

  @Patch("landing-images/marcas-hero-carousel/:imageId/move")
  moveMarcasHeroCarouselImage(@Param("imageId", ParseUUIDPipe) imageId: string, @Body() dto: MoveCarouselImageDto) {
    return this.settings.moveMarcasHeroCarouselImage(imageId, dto.direction);
  }

  @Patch("landing-images/marcas-hero-carousel/:imageId/url")
  setMarcasHeroCarouselImageUrl(@Param("imageId", ParseUUIDPipe) imageId: string, @Body() dto: UpdateCarouselImageUrlDto) {
    return this.settings.setMarcasHeroCarouselImageUrl(imageId, dto.url ?? null);
  }

  @Get("landing-images/offers-banner-carousel")
  listOffersBannerCarouselImages() {
    return this.settings.listOffersBannerCarouselImages();
  }

  @Post("landing-images/offers-banner-carousel")
  @UseInterceptors(FileInterceptor("file", carouselImageMulterOptions))
  addOffersBannerCarouselImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.settings.addOffersBannerCarouselImage(file);
  }

  @Delete("landing-images/offers-banner-carousel/:imageId")
  removeOffersBannerCarouselImage(@Param("imageId", ParseUUIDPipe) imageId: string) {
    return this.settings.removeOffersBannerCarouselImage(imageId);
  }

  @Patch("landing-images/offers-banner-carousel/:imageId/move")
  moveOffersBannerCarouselImage(@Param("imageId", ParseUUIDPipe) imageId: string, @Body() dto: MoveCarouselImageDto) {
    return this.settings.moveOffersBannerCarouselImage(imageId, dto.direction);
  }

  @Patch("landing-images/offers-banner-carousel/:imageId/url")
  setOffersBannerCarouselImageUrl(@Param("imageId", ParseUUIDPipe) imageId: string, @Body() dto: UpdateCarouselImageUrlDto) {
    return this.settings.setOffersBannerCarouselImageUrl(imageId, dto.url ?? null);
  }

  @Get("landing-images/weekly-collection-carousel")
  listWeeklyCollectionBannerCarouselImages() {
    return this.settings.listWeeklyCollectionBannerCarouselImages();
  }

  @Post("landing-images/weekly-collection-carousel")
  @UseInterceptors(FileInterceptor("file", carouselImageMulterOptions))
  addWeeklyCollectionBannerCarouselImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Archivo inválido: debe ser una imagen JPEG, PNG, WEBP o GIF de hasta 5MB.");
    }
    return this.settings.addWeeklyCollectionBannerCarouselImage(file);
  }

  @Delete("landing-images/weekly-collection-carousel/:imageId")
  removeWeeklyCollectionBannerCarouselImage(@Param("imageId", ParseUUIDPipe) imageId: string) {
    return this.settings.removeWeeklyCollectionBannerCarouselImage(imageId);
  }

  @Patch("landing-images/weekly-collection-carousel/:imageId/move")
  moveWeeklyCollectionBannerCarouselImage(@Param("imageId", ParseUUIDPipe) imageId: string, @Body() dto: MoveCarouselImageDto) {
    return this.settings.moveWeeklyCollectionBannerCarouselImage(imageId, dto.direction);
  }

  @Patch("landing-images/weekly-collection-carousel/:imageId/url")
  setWeeklyCollectionBannerCarouselImageUrl(@Param("imageId", ParseUUIDPipe) imageId: string, @Body() dto: UpdateCarouselImageUrlDto) {
    return this.settings.setWeeklyCollectionBannerCarouselImageUrl(imageId, dto.url ?? null);
  }

  @Get("weekly-collection-brand")
  async getWeeklyCollectionBrand() {
    return { brandId: await this.settings.getWeeklyCollectionBrandId() };
  }

  @Put("weekly-collection-brand")
  setWeeklyCollectionBrand(@Body() dto: UpdateWeeklyCollectionBrandDto) {
    return this.settings.setWeeklyCollectionBrand(dto.brandId ?? null);
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
