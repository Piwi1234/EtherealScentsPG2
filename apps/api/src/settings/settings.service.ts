import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { Injectable, NotFoundException } from "@nestjs/common";
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

  /** Público (sin auth) — los carruseles del hero del home, del hero de /marcas, del banner de
   * ofertas del home y del banner de "Colección de la semana" (con su `url` de redirección si
   * tiene), la marca elegida para ese bloque, y las imágenes de "Propuesta de valor"/"Sobre
   * nosotros" del home. */
  async getLandingImages() {
    const [setting, heroImages, marcasHeroImages, offersBannerImages, weeklyCollectionBannerImages] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID }, include: { weeklyCollectionBrand: true } }),
      this.carouselImages.list(null, "FEATURE"),
      this.carouselImages.list(null, "MARCAS_HERO"),
      this.carouselImages.list(null, "OFFERS_BANNER"),
      this.carouselImages.list(null, "WEEKLY_COLLECTION_BANNER"),
    ]);
    return {
      heroImages,
      marcasHeroImages,
      offersBannerImages,
      weeklyCollectionBannerImages,
      weeklyCollectionBrand: setting?.weeklyCollectionBrand ?? null,
      valueImageUrl: setting?.valueImageUrl ?? null,
      aboutImageUrl: setting?.aboutImageUrl ?? null,
    };
  }

  /** Público (sin auth) — el footer del sitio público lo usa para pintar el bloque "Contacto". */
  async getContactoInfo() {
    const setting = await this.prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
    return {
      telefonos: setting?.telefonos ?? null,
      email: setting?.email ?? null,
      ciudad: setting?.ciudad ?? null,
    };
  }

  async setContactoInfo(data: { telefonos?: string; email?: string; ciudad?: string }) {
    const setting = await this.prisma.systemSetting.upsert({
      where: { id: SETTINGS_ID },
      update: data,
      create: { id: SETTINGS_ID, ...data },
    });
    return { telefonos: setting.telefonos, email: setting.email, ciudad: setting.ciudad };
  }

  /** Marca elegida para el bloque "Colección de la semana" del home — se edita desde Marcas del
   * panel de gestión, aunque el valor vive en SystemSetting (singleton) como el resto de la config
   * global. Null = el bloque no se muestra. */
  async getWeeklyCollectionBrandId(): Promise<string | null> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
    return setting?.weeklyCollectionBrandId ?? null;
  }

  async setWeeklyCollectionBrand(brandId: string | null) {
    if (brandId) {
      const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
      if (!brand) {
        throw new NotFoundException("Marca no encontrada.");
      }
    }
    const setting = await this.prisma.systemSetting.upsert({
      where: { id: SETTINGS_ID },
      update: { weeklyCollectionBrandId: brandId },
      create: { id: SETTINGS_ID, weeklyCollectionBrandId: brandId },
    });
    return { brandId: setting.weeklyCollectionBrandId };
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

  setHeroCarouselImageUrl(imageId: string, url: string | null) {
    return this.carouselImages.setUrl(imageId, url);
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

  setMarcasHeroCarouselImageUrl(imageId: string, url: string | null) {
    return this.carouselImages.setUrl(imageId, url);
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

  setOffersBannerCarouselImageUrl(imageId: string, url: string | null) {
    return this.carouselImages.setUrl(imageId, url);
  }

  /** El carrusel del banner de "Colección de la semana" del home (categoryId null, kind
   * WEEKLY_COLLECTION_BANNER) — mismo tamaño que una tarjeta de producto, independiente de los demás. */
  listWeeklyCollectionBannerCarouselImages() {
    return this.carouselImages.list(null, "WEEKLY_COLLECTION_BANNER");
  }

  addWeeklyCollectionBannerCarouselImage(file: Express.Multer.File) {
    return this.carouselImages.add(null, "WEEKLY_COLLECTION_BANNER", file);
  }

  removeWeeklyCollectionBannerCarouselImage(imageId: string) {
    return this.carouselImages.remove(imageId);
  }

  moveWeeklyCollectionBannerCarouselImage(imageId: string, direction: "up" | "down") {
    return this.carouselImages.move(imageId, direction);
  }

  setWeeklyCollectionBannerCarouselImageUrl(imageId: string, url: string | null) {
    return this.carouselImages.setUrl(imageId, url);
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
