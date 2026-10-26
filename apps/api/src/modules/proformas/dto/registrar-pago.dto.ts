import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from "class-validator";

export class RegistrarPagoDto {
  @ApiProperty({ description: "Cartera en Bs donde entra el pago." })
  @IsUUID()
  carteraId!: string;

  @ApiProperty({ example: 500, description: "Monto en Bs; no puede superar el saldo pendiente de la proforma." })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto!: number;

  @ApiPropertyOptional({ description: "Nota que se agrega al detalle del movimiento (ej. 'abono', 'transferencia')." })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nota?: string;
}
