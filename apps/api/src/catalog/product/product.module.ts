import { Module } from "@nestjs/common";
import { CategoryModule } from "../category/category.module";
import { AttributeModule } from "../attribute/attribute.module";
import { SettingsModule } from "../../settings/settings.module";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";

@Module({
  imports: [CategoryModule, AttributeModule, SettingsModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
