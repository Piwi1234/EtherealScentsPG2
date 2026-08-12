import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsUUID, Min, ValidateNested } from "class-validator";

export class AsignacionLoteDto {
  @ApiProperty()
  @IsUUID()
  proformaDetalleAsignacionId!: string;

  @ApiProperty()
  @IsUUID()
  loteCompraId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class CompletarProformaDto {
  @ApiPropertyOptional({ description: "Solo COMPRA: almacén que recibe la mercadería." })
  @IsOptional()
  @IsUUID()
  almacenId?: string;

  @ApiPropertyOptional({
    type: [AsignacionLoteDto],
    description: "Solo VENTA: de qué lote(s) sale cada asignación con stock (STOCK), repartido manualmente.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsignacionLoteDto)
  asignaciones?: AsignacionLoteDto[];
}
