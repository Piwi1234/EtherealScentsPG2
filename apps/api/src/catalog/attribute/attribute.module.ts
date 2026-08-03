import { Module } from "@nestjs/common";
import { CategoryModule } from "../category/category.module";
import { AttributeController } from "./attribute.controller";
import { CategoryAttributesController } from "./category-attributes.controller";
import { AttributeService } from "./attribute.service";

@Module({
  imports: [CategoryModule],
  controllers: [AttributeController, CategoryAttributesController],
  providers: [AttributeService],
  exports: [AttributeService],
})
export class AttributeModule {}
