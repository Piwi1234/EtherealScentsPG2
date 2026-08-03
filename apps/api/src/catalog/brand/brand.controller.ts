import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { BrandService } from "./brand.service";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";

@ApiTags("brands")
@Controller("brands")
export class BrandController {
  constructor(private readonly brands: BrandService) {}

  @Get()
  findAll(@Query("categoryId") categoryId?: string) {
    return this.brands.findAll({ categoryId });
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.brands.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateBrandDto) {
    return this.brands.create(dto);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateBrandDto) {
    return this.brands.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.brands.remove(id);
  }
}
