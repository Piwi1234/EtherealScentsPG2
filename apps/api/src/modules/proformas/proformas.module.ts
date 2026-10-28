import { Module } from "@nestjs/common";
import { SettingsModule } from "../../settings/settings.module";
import { CategoryModule } from "../../catalog/category/category.module";
import { ProformasController } from "./proformas.controller";
import { ProformasService } from "./proformas.service";
import { ProformaHistorialService } from "./proforma-historial.service";
import { ProformaApprovalService } from "./proforma-approval.service";
import { ProformaCompletionService } from "./proforma-completion.service";
import { ProformaPagosService } from "./proforma-pagos.service";
import { ProformaPdfService } from "./proforma-pdf.service";
import { ProformaAjusteService } from "./proforma-ajuste.service";
import { ProformaEntregaService } from "./proforma-entrega.service";
import { SeguimientoResumenController } from "./seguimiento/seguimiento-resumen.controller";
import { SeguimientoService } from "./seguimiento/seguimiento.service";
import { SeguimientoExportService } from "./seguimiento/seguimiento-export.service";
import { RegistrosController } from "./registros/registros.controller";
import { RegistrosService } from "./registros/registros.service";
import { EnviosController } from "./envios/envios.controller";
import { EnviosService } from "./envios/envios.service";
import { EnvioPdfService } from "./envios/envio-pdf.service";
import { RecojosController } from "./recojos/recojos.controller";
import { RecojosService } from "./recojos/recojos.service";
import { SolicitudesStockController } from "./solicitudes-stock/solicitudes-stock.controller";
import { SolicitudesStockService } from "./solicitudes-stock/solicitudes-stock.service";

@Module({
  imports: [SettingsModule, CategoryModule],
  // SeguimientoResumenController/RegistrosController (rutas estáticas "proformas/seguimiento" y
  // "proformas/registros") van ANTES que ProformasController: Nest/Express matchea rutas en orden de
  // registro, y "GET proformas/:id" capturaría esos segmentos como :id si quedaran primero.
  controllers: [SeguimientoResumenController, RegistrosController, EnviosController, SolicitudesStockController, RecojosController, ProformasController],
  providers: [
    ProformasService,
    ProformaHistorialService,
    ProformaApprovalService,
    ProformaCompletionService,
    ProformaPagosService,
    ProformaPdfService,
    ProformaAjusteService,
    ProformaEntregaService,
    SeguimientoService,
    SeguimientoExportService,
    RegistrosService,
    EnviosService,
    EnvioPdfService,
    SolicitudesStockService,
    RecojosService,
  ],
})
export class ProformasModule {}
