import { Module } from "@nestjs/common";
import { CiudadController } from "./ciudad.controller";
import { CiudadService } from "./ciudad.service";
import { AlmacenController } from "./almacen.controller";
import { AlmacenService } from "./almacen.service";
import { StockController } from "./stock.controller";
import { StockService } from "./stock.service";

@Module({
  controllers: [CiudadController, AlmacenController, StockController],
  providers: [CiudadService, AlmacenService, StockService],
  exports: [CiudadService, AlmacenService, StockService],
})
export class AlmacenesModule {}
