import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateTipoMovimientoDto } from "./create-tipo-movimiento.dto";

/** naturaleza no se puede cambiar después de creado: cambiaría el sentido de los movimientos
 * históricos que ya lo usan. Si hace falta el otro sentido, se crea un tipo nuevo. */
export class UpdateTipoMovimientoDto extends PartialType(OmitType(CreateTipoMovimientoDto, ["naturaleza"] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
