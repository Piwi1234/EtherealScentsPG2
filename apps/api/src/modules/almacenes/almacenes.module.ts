import { Module } from "@nestjs/common";
import { CiudadController } from "./ciudad.controller";
import { CiudadService } from "./ciudad.service";
import { PaisProcedenciaController } from "./pais-procedencia.controller";
import { PaisProcedenciaService } from "./pais-procedencia.service";
import { AlmacenController } from "./almacen.controller";
import { AlmacenService } from "./almacen.service";
import { StockController } from "./stock.controller";
import { StockService } from "./stock.service";
import { StockExportService } from "./stock-export.service";
import { TraspasoAlmacenController } from "./traspaso-almacen.controller";
import { TraspasoAlmacenService } from "./traspaso-almacen.service";
import { ProbadorController } from "./probador.controller";
import { ProbadorService } from "./probador.service";
import { SettingsModule } from "../../settings/settings.module";

@Module({
  imports: [SettingsModule],
  controllers: [CiudadController, PaisProcedenciaController, AlmacenController, StockController, TraspasoAlmacenController, ProbadorController],
  providers: [CiudadService, PaisProcedenciaService, AlmacenService, StockService, StockExportService, TraspasoAlmacenService, ProbadorService],
  exports: [CiudadService, PaisProcedenciaService, AlmacenService, StockService, TraspasoAlmacenService],
})
export class AlmacenesModule {}
