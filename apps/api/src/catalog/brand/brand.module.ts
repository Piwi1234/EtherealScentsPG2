import { Module } from "@nestjs/common";
import { BrandController } from "./brand.controller";
import { BrandService } from "./brand.service";
import { BrandImportService } from "./brand-import.service";

@Module({
  controllers: [BrandController],
  providers: [BrandService, BrandImportService],
  exports: [BrandService],
})
export class BrandModule {}
