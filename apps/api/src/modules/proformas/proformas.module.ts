import { Module } from "@nestjs/common";
import { SettingsModule } from "../../settings/settings.module";
import { ProformasController } from "./proformas.controller";
import { ProformasService } from "./proformas.service";
import { ProformaHistorialService } from "./proforma-historial.service";
import { ProformaApprovalService } from "./proforma-approval.service";
import { ProformaCompletionService } from "./proforma-completion.service";
import { SeguimientoController } from "./seguimiento/seguimiento.controller";
import { SeguimientoResumenController } from "./seguimiento/seguimiento-resumen.controller";
import { SeguimientoService } from "./seguimiento/seguimiento.service";

@Module({
  imports: [SettingsModule],
  // SeguimientoResumenController (ruta estática "proformas/seguimiento") va ANTES que
  // ProformasController: Nest/Express matchea rutas en orden de registro, y "GET proformas/:id"
  // capturaría "seguimiento" como :id si quedara primero.
  controllers: [SeguimientoResumenController, SeguimientoController, ProformasController],
  providers: [ProformasService, ProformaHistorialService, ProformaApprovalService, ProformaCompletionService, SeguimientoService],
})
export class ProformasModule {}
