import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SettingsService } from "./settings.service";
import { UpdateExchangeRateDto } from "./dto/update-exchange-rate.dto";

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
}
