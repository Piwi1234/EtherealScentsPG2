import { Module } from "@nestjs/common";
import { CategoryModule } from "../../catalog/category/category.module";
import { SettingsModule } from "../../settings/settings.module";
import { CampanaService } from "./campana.service";
import { CampanaPublicaController, CampanasController } from "./campanas.controller";

@Module({
  imports: [CategoryModule, SettingsModule],
  controllers: [CampanasController, CampanaPublicaController],
  providers: [CampanaService],
  exports: [CampanaService],
})
export class CampanasModule {}
