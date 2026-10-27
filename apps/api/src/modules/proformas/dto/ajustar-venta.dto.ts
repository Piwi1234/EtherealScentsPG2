import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from "class-validator";

export class AjusteLineaDto {
  @ApiProperty()
  @IsUUID()
  detalleId!: string;

  @ApiProperty({ description: "Cantidad nueva de la línea (menor a la actual; 0 quita el producto)." })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cantidad!: number;
}

export class AjustarVentaDto {
  @ApiProperty({ type: [AjusteLineaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AjusteLineaDto)
  lineas!: AjusteLineaDto[];

  @ApiPropertyOptional({ description: "Cartera en Bs de la que sale la devolución. Obligatoria si lo cobrado supera el nuevo total." })
  @IsOptional()
  @IsUUID()
  carteraId?: string;

  @ApiPropertyOptional({ description: "Motivo del ajuste (queda en el historial)." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}
