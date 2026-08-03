import { Module } from "@nestjs/common";
import { CategoryModule } from "../category/category.module";
import { AttributeModule } from "../attribute/attribute.module";
import { CatalogBrowseController } from "./browse.controller";
import { CatalogBrowseService } from "./browse.service";

@Module({
  imports: [CategoryModule, AttributeModule],
  controllers: [CatalogBrowseController],
  providers: [CatalogBrowseService],
})
export class CatalogBrowseModule {}
