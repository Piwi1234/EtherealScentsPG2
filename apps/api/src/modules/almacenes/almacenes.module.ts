import { Module } from "@nestjs/common";
import { CiudadController } from "./ciudad.controller";
import { CiudadService } from "./ciudad.service";
import { CiudadProcedenciaController } from "./ciudad-procedencia.controller";
import { CiudadProcedenciaService } from "./ciudad-procedencia.service";
import { AlmacenController } from "./almacen.controller";
import { AlmacenService } from "./almacen.service";
import { StockController } from "./stock.controller";
import { StockService } from "./stock.service";
import { TraspasoAlmacenController } from "./traspaso-almacen.controller";
import { TraspasoAlmacenService } from "./traspaso-almacen.service";

@Module({
  controllers: [CiudadController, CiudadProcedenciaController, AlmacenController, StockController, TraspasoAlmacenController],
  providers: [CiudadService, CiudadProcedenciaService, AlmacenService, StockService, TraspasoAlmacenService],
  exports: [CiudadService, CiudadProcedenciaService, AlmacenService, StockService, TraspasoAlmacenService],
})
export class AlmacenesModule {}
