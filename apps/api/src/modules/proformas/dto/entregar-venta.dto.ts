import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from "class-validator";

export class EntregaLoteDto {
  @ApiProperty()
  @IsUUID()
  loteCompraId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class EntregaLineaDto {
  @ApiProperty({ description: "Línea de la nota de venta que se entrega." })
  @IsUUID()
  proformaDetalleId!: string;

  @ApiProperty({
    type: [EntregaLoteDto],
    description: "De qué lote(s) sale lo que se entrega; la suma es la cantidad entregada (hasta lo reservado en stock físico de la línea).",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EntregaLoteDto)
  lotes!: EntregaLoteDto[];
}

export class EntregarVentaDto {
  @ApiProperty({ type: [EntregaLineaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EntregaLineaDto)
  lineas!: EntregaLineaDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;
}
