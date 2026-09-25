import { Module } from "@nestjs/common";
import { BackfillR2Controller } from "./backfill-r2.controller";
import { BackfillR2Service } from "./backfill-r2.service";

/** TEMPORAL — ver backfill-r2.service.ts. Sacar este módulo entero (y su import en app.module.ts)
 * una vez terminado el backfill de producción. */
@Module({
  controllers: [BackfillR2Controller],
  providers: [BackfillR2Service],
})
export class AdminToolsModule {}
