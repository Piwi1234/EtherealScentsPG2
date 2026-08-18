import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsInt, Min } from "class-validator";
import { EstadoSeguimientoProcura } from "@app/database";

export class UpdateEstadoSeguimientoDto {
  @ApiProperty({ enum: EstadoSeguimientoProcura })
  @IsEnum(EstadoSeguimientoProcura)
  estado!: EstadoSeguimientoProcura;

  @ApiProperty({
    description:
      "Cuántas unidades de la línea pasan a este estado. Si es menor a la cantidad pendiente de la línea, la " +
      "línea se parte en dos: la cantidad indicada avanza de estado, el resto queda como estaba.",
  })
  @IsInt()
  @Min(1)
  cantidad!: number;
}
