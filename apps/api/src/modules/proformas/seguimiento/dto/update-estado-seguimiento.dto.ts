import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { EstadoSeguimientoProcura } from "@app/database";

export class UpdateEstadoSeguimientoDto {
  @ApiProperty({ enum: EstadoSeguimientoProcura })
  @IsEnum(EstadoSeguimientoProcura)
  estado!: EstadoSeguimientoProcura;
}
