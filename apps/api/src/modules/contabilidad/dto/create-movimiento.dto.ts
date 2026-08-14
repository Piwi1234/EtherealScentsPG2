import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsString, IsUUID, Min } from "class-validator";
import { NaturalezaMovimiento } from "@app/database";

export class CreateMovimientoDto {
  @ApiProperty({ description: "Fecha del movimiento (puede ser pasada — no tiene que ser hoy)." })
  @IsDateString()
  fecha!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  detalle!: string;

  @ApiProperty({ enum: NaturalezaMovimiento })
  @IsEnum(NaturalezaMovimiento)
  naturaleza!: NaturalezaMovimiento;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  monto!: number;

  @ApiProperty({ description: "Debe pertenecer a esta cartera y tener la misma naturaleza." })
  @IsUUID()
  tipoMovimientoId!: string;
}
