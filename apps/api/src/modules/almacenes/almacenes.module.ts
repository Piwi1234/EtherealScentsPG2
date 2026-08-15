import { Module } from "@nestjs/common";
import { CiudadController } from "./ciudad.controller";
import { CiudadService } from "./ciudad.service";
import { PaisProcedenciaController } from "./pais-procedencia.controller";
import { PaisProcedenciaService } from "./pais-procedencia.service";
import { AlmacenController } from "./almacen.controller";
import { AlmacenService } from "./almacen.service";
import { StockController } from "./stock.controller";
import { StockService } from "./stock.service";
import { TraspasoAlmacenController } from "./traspaso-almacen.controller";
import { TraspasoAlmacenService } from "./traspaso-almacen.service";

@Module({
  controllers: [CiudadController, PaisProcedenciaController, AlmacenController, StockController, TraspasoAlmacenController],
  providers: [CiudadService, PaisProcedenciaService, AlmacenService, StockService, TraspasoAlmacenService],
  exports: [CiudadService, PaisProcedenciaService, AlmacenService, StockService, TraspasoAlmacenService],
})
export class AlmacenesModule {}
