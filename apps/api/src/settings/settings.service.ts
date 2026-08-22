import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { LANDING_IMAGES_DIR } from "./landing-image.multer";

const SETTINGS_ID = "default";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

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

  /** Público (sin auth) — las imágenes de "Propuesta de valor" y "Sobre nosotros" del home. */
  async getLandingImages() {
    const setting = await this.prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
    return { valueImageUrl: setting?.valueImageUrl ?? null, aboutImageUrl: setting?.aboutImageUrl ?? null };
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
