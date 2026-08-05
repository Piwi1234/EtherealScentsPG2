import { Module } from "@nestjs/common";
import { CiudadController } from "./ciudad.controller";
import { CiudadService } from "./ciudad.service";
import { AlmacenController } from "./almacen.controller";
import { AlmacenService } from "./almacen.service";
import { ZonaCoberturaController } from "./zona-cobertura.controller";
import { ZonaCoberturaService } from "./zona-cobertura.service";

@Module({
  controllers: [CiudadController, AlmacenController, ZonaCoberturaController],
  providers: [CiudadService, AlmacenService, ZonaCoberturaService],
  exports: [CiudadService, AlmacenService, ZonaCoberturaService],
})
export class AlmacenesModule {}
