import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { CarouselImageService } from "../catalog/carousel-image/carousel-image.service";
import { LANDING_IMAGES_DIR } from "./landing-image.multer";

const SETTINGS_ID = "default";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carouselImages: CarouselImageService,
  ) {}

  async getExchangeRate(): Promise<number> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
    return setting ? Number(setting.exchangeRate) : 0;
  }

  async setExchangeRate(rate: number): Promise<number> {
    const setting = await this.prisma.systemSetting.upsert({
      where: { id: SETTINGS_ID },
      update: { exchangeRate: rate },
      create: { id: SETTINGS_ID, exchangeRate: rate },
    });
    return Number(setting.exchangeRate);
  }

  /** Público (sin auth) — los carruseles del hero del home, del hero de /marcas y del banner de
   * ofertas del home, y las imágenes de "Propuesta de valor"/"Sobre nosotros" del home. */
  async getLandingImages() {
    const [setting, heroImages, marcasHeroImages, offersBannerImages] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } }),
      this.carouselImages.list(null, "FEATURE"),
      this.carouselImages.list(null, "MARCAS_HERO"),
      this.carouselImages.list(null, "OFFERS_BANNER"),
    ]);
    return {
      heroImages: heroImages.map((image) => image.imageUrl),
      marcasHeroImages: marcasHeroImages.map((image) => image.imageUrl),
      offersBannerImages: offersBannerImages.map((image) => image.imageUrl),
      valueImageUrl: setting?.valueImageUrl ?? null,
      aboutImageUrl: setting?.aboutImageUrl ?? null,
    };
  }

  /** El carrusel del Hero (categoryId null en CarouselImage) — igual mecanismo que el de una
   * categoría raíz, ver CategoryService.addCarouselImage/removeCarouselImage/moveCarouselImage. */
  listHeroCarouselImages() {
    return this.carouselImages.list(null, "FEATURE");
  }

  addHeroCarouselImage(file: Express.Multer.File) {
    return this.carouselImages.add(null, "FEATURE", file);
  }

  removeHeroCarouselImage(imageId: string) {
    return this.carouselImages.remove(imageId);
  }

  moveHeroCarouselImage(imageId: string, direction: "up" | "down") {
    return this.carouselImages.move(imageId, direction);
  }

  /** El carrusel del hero de /marcas (categoryId null, kind MARCAS_HERO) — independiente del Hero
   * principal del home, mismo mecanismo. */
  listMarcasHeroCarouselImages() {
    return this.carouselImages.list(null, "MARCAS_HERO");
  }

  addMarcasHeroCarouselImage(file: Express.Multer.File) {
    return this.carouselImages.add(null, "MARCAS_HERO", file);
  }

  removeMarcasHeroCarouselImage(imageId: string) {
    return this.carouselImages.remove(imageId);
  }

  moveMarcasHeroCarouselImage(imageId: string, direction: "up" | "down") {
    return this.carouselImages.move(imageId, direction);
  }

  /** El carrusel del banner de ofertas del home (categoryId null, kind OFFERS_BANNER) — ocupa el
   * 5to lugar de la fila de "Descuento y Ofertas", mismo tamaño que una tarjeta de producto. */
  listOffersBannerCarouselImages() {
    return this.carouselImages.list(null, "OFFERS_BANNER");
  }

  addOffersBannerCarouselImage(file: Express.Multer.File) {
    return this.carouselImages.add(null, "OFFERS_BANNER", file);
  }

  removeOffersBannerCarouselImage(imageId: string) {
    return this.carouselImages.remove(imageId);
  }

  moveOffersBannerCarouselImage(imageId: string, direction: "up" | "down") {
    return this.carouselImages.move(imageId, direction);
  }

  private async setLandingImage(field: "valueImageUrl" | "aboutImageUrl", file: Express.Multer.File) {
    const existing = await this.prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
    const url = `/uploads/landing/${file.filename}`;

    const updated = await this.prisma.systemSetting.upsert({
      where: { id: SETTINGS_ID },
      update: { [field]: url },
      create: { id: SETTINGS_ID, [field]: url },
    });

    // Best-effort: borra la imagen anterior para no acumular huérfanos en disco.
    const previousUrl = existing?.[field];
    if (previousUrl) {
      const previousFilename = previousUrl.split("/").pop();
      if (previousFilename) {
        await unlink(join(LANDING_IMAGES_DIR, previousFilename)).catch(() => {});
      }
    }

    return updated;
  }

  setValueImage(file: Express.Multer.File) {
    return this.setLandingImage("valueImageUrl", file);
  }

  setAboutImage(file: Express.Multer.File) {
    return this.setLandingImage("aboutImageUrl", file);
  }
}
