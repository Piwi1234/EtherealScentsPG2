import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../../modules/auth/decorators/roles.decorator";
import { AttributeService } from "./attribute.service";
import { UpdateAttributeDto } from "./dto/update-attribute.dto";
import { CreateAttributeOptionDto, UpdateAttributeOptionDto } from "./dto/attribute-option.dto";

@ApiTags("attributes")
@Controller("attributes")
export class AttributeController {
  constructor(private readonly attributes: AttributeService) {}

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.attributes.findOne(id);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateAttributeDto) {
    return this.attributes.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.attributes.remove(id);
  }

  // Reestructura catálogo real (crea variantes) — a diferencia del resto de este controller, se
  // gatea a ADMIN a propósito.
  @Post(":id/convertir-a-precio-propio")
  @Roles(Rol.ADMIN)
  convertirAPrecioPropio(@Param("id", ParseUUIDPipe) id: string) {
    return this.attributes.convertirMultiValueAPrecioPropio(id);
  }

  @Post(":id/options")
  addOption(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateAttributeOptionDto) {
    return this.attributes.addOption(id, dto);
  }

  @Patch(":id/options/:optionId")
  updateOption(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("optionId", ParseUUIDPipe) optionId: string,
    @Body() dto: UpdateAttributeOptionDto,
  ) {
    return this.attributes.updateOption(id, optionId, dto);
  }

  @Delete(":id/options/:optionId")
  removeOption(@Param("id", ParseUUIDPipe) id: string, @Param("optionId", ParseUUIDPipe) optionId: string) {
    return this.attributes.removeOption(id, optionId);
  }
}
