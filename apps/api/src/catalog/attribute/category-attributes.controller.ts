import { Body, Controller, Get, Param, ParseBoolPipe, ParseUUIDPipe, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AttributeService } from "./attribute.service";
import { CreateAttributeDto } from "./dto/create-attribute.dto";

@ApiTags("categories")
@Controller("categories/:categoryId/attributes")
export class CategoryAttributesController {
  constructor(private readonly attributes: AttributeService) {}

  @Get()
  findAll(
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
    @Query("includeInherited", new ParseBoolPipe({ optional: true })) includeInherited?: boolean,
  ) {
    return this.attributes.listForCategory(categoryId, includeInherited ?? true);
  }

  @Post()
  create(@Param("categoryId", ParseUUIDPipe) categoryId: string, @Body() dto: CreateAttributeDto) {
    return this.attributes.create(categoryId, dto);
  }
}
