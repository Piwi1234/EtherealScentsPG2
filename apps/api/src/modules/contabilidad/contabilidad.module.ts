import { Module } from "@nestjs/common";
import { CarteraController } from "./cartera.controller";
import { CarteraService } from "./cartera.service";
import { TipoMovimientoController } from "./tipo-movimiento.controller";
import { TipoMovimientoService } from "./tipo-movimiento.service";
import { MovimientoController } from "./movimiento.controller";
import { MovimientoService } from "./movimiento.service";
import { TraspasoController } from "./traspaso.controller";
import { TraspasoService } from "./traspaso.service";

@Module({
  controllers: [CarteraController, TipoMovimientoController, MovimientoController, TraspasoController],
  providers: [CarteraService, TipoMovimientoService, MovimientoService, TraspasoService],
})
export class ContabilidadModule {}
