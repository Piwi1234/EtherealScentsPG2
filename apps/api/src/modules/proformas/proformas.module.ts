import { Module } from "@nestjs/common";
import { SettingsModule } from "../../settings/settings.module";
import { CategoryModule } from "../../catalog/category/category.module";
import { ProformasController } from "./proformas.controller";
import { ProformasService } from "./proformas.service";
import { ProformaHistorialService } from "./proforma-historial.service";
import { ProformaApprovalService } from "./proforma-approval.service";
import { ProformaCompletionService } from "./proforma-completion.service";
import { ProformaPdfService } from "./proforma-pdf.service";
import { SeguimientoResumenController } from "./seguimiento/seguimiento-resumen.controller";
import { SeguimientoService } from "./seguimiento/seguimiento.service";
import { RegistrosController } from "./registros/registros.controller";
import { RegistrosService } from "./registros/registros.service";

@Module({
  imports: [SettingsModule, CategoryModule],
  // SeguimientoResumenController/RegistrosController (rutas estáticas "proformas/seguimiento" y
  // "proformas/registros") van ANTES que ProformasController: Nest/Express matchea rutas en orden de
  // registro, y "GET proformas/:id" capturaría esos segmentos como :id si quedaran primero.
  controllers: [SeguimientoResumenController, RegistrosController, ProformasController],
  providers: [
    ProformasService,
    ProformaHistorialService,
    ProformaApprovalService,
    ProformaCompletionService,
    ProformaPdfService,
    SeguimientoService,
    RegistrosService,
  ],
})
export class ProformasModule {}
