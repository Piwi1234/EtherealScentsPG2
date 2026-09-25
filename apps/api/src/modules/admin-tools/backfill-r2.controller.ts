import { Controller, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Rol } from "@app/database";
import { Roles } from "../auth/decorators/roles.decorator";
import { BackfillR2Service } from "./backfill-r2.service";

/** TEMPORAL — ver backfill-r2.service.ts. Sacar este controller (y el módulo entero) una vez
 * terminado el backfill de producción. */
@ApiTags("admin-tools")
@ApiBearerAuth()
@Roles(Rol.ADMIN)
@Controller("admin/backfill-r2-images")
export class BackfillR2Controller {
  constructor(private readonly backfill: BackfillR2Service) {}

  @Post()
  @ApiOperation({
    summary:
      "Migra a R2 las imágenes que todavía están en el volumen local (imageUrl/logoUrl con formato /uploads/...) y actualiza cada fila. " +
      "?deleteLocal=true borra el archivo local recién después de confirmar la subida+update de esa fila puntual.",
  })
  run(@Query("deleteLocal") deleteLocal?: string) {
    return this.backfill.run(deleteLocal === "true");
  }
}
