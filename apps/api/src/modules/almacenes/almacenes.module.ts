import { Module } from "@nestjs/common";
import { CiudadController } from "./ciudad.controller";
import { CiudadService } from "./ciudad.service";
import { AlmacenController } from "./almacen.controller";
import { AlmacenService } from "./almacen.service";
import { ZonaCoberturaController } from "./zona-cobertura.controller";
import { ZonaCoberturaService } from "./zona-cobertura.service";
import { StockController } from "./stock.controller";
import { StockService } from "./stock.service";

@Module({
  controllers: [CiudadController, AlmacenController, ZonaCoberturaController, StockController],
  providers: [CiudadService, AlmacenService, ZonaCoberturaService, StockService],
  exports: [CiudadService, AlmacenService, ZonaCoberturaService, StockService],
})
export class AlmacenesModule {}
