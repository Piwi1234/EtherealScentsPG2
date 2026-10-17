import { Module } from "@nestjs/common";
import { CategoryModule } from "./category/category.module";
import { BrandModule } from "./brand/brand.module";
import { AttributeModule } from "./attribute/attribute.module";
import { ProductModule } from "./product/product.module";
import { CatalogBrowseModule } from "./browse/browse.module";
import { HistoriaModule } from "./historia/historia.module";

@Module({
  imports: [CategoryModule, BrandModule, AttributeModule, ProductModule, CatalogBrowseModule, HistoriaModule],
})
export class CatalogModule {}
