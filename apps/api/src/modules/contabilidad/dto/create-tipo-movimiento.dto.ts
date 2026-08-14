import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { NaturalezaMovimiento } from "@app/database";

export class CreateTipoMovimientoDto {
  @ApiProperty({ example: "Venta de mercadería" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiProperty({ enum: NaturalezaMovimiento })
  @IsEnum(NaturalezaMovimiento)
  naturaleza!: NaturalezaMovimiento;
}
