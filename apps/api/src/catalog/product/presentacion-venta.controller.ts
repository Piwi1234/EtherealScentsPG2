import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PresentacionVentaService } from "./presentacion-venta.service";
import { CreatePresentacionVentaDto, UpdatePresentacionVentaDto } from "./dto/presentacion-venta.dto";

@ApiTags("products")
@Controller("products")
export class PresentacionVentaController {
  constructor(private readonly presentaciones: PresentacionVentaService) {}

  @Get("variants/:varianteId/presentaciones")
  findAll(@Param("varianteId", ParseUUIDPipe) varianteId: string) {
    return this.presentaciones.findAll(varianteId);
  }

  @Post("variants/:varianteId/presentaciones")
  create(@Param("varianteId", ParseUUIDPipe) varianteId: string, @Body() dto: CreatePresentacionVentaDto) {
    return this.presentaciones.create(varianteId, dto);
  }

  @Patch("presentaciones/:id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePresentacionVentaDto) {
    return this.presentaciones.update(id, dto);
  }
}
