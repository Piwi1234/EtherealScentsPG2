import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from "class-validator";

export class CambiarOrigenLineaDto {
  @ApiProperty()
  @IsUUID()
  detalleId!: string;

  @ApiPropertyOptional({ description: "Unidades reservadas del almacén (o en tránsito) que pasan a pedido de Seguimiento, sin tomar stock." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pasarAPedido?: number;

  @ApiPropertyOptional({ description: "Unidades de pedido a propósito (todavía sin compra ligada) que vuelven a tomarse del stock." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  volverAStock?: number;
}

export class CambiarOrigenDto {
  @ApiProperty({ type: [CambiarOrigenLineaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CambiarOrigenLineaDto)
  lineas!: CambiarOrigenLineaDto[];

  @ApiPropertyOptional({ description: "Motivo (queda en el historial de la nota)." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}
