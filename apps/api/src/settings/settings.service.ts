import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

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
}
