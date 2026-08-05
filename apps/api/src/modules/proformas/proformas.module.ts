import { Module } from "@nestjs/common";
import { SettingsModule } from "../../settings/settings.module";
import { ProformasController } from "./proformas.controller";
import { ProformasService } from "./proformas.service";
import { ProformaHistorialService } from "./proforma-historial.service";
import { ProformaApprovalService } from "./proforma-approval.service";
import { ProformaCompletionService } from "./proforma-completion.service";
import { SeguimientoController } from "./seguimiento/seguimiento.controller";
import { SeguimientoService } from "./seguimiento/seguimiento.service";

@Module({
  imports: [SettingsModule],
  controllers: [ProformasController, SeguimientoController],
  providers: [ProformasService, ProformaHistorialService, ProformaApprovalService, ProformaCompletionService, SeguimientoService],
})
export class ProformasModule {}
