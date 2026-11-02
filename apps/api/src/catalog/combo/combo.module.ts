import { Module } from "@nestjs/common";
import { SettingsModule } from "../../settings/settings.module";
import { CategoryModule } from "../category/category.module";
import { ComboController, ComboPublicController } from "./combo.controller";
import { ComboService } from "./combo.service";

@Module({
  imports: [CategoryModule, SettingsModule],
  controllers: [ComboController, ComboPublicController],
  providers: [ComboService],
  exports: [ComboService],
})
export class ComboModule {}
