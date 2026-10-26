import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, ArrayUnique, IsArray, IsInt, IsOptional, IsUUID, Min, ValidateNested } from "class-validator";

export class LineaCrearCompraDto {
  @ApiProperty()
  @IsUUID()
  varianteId!: string;

  @ApiPropertyOptional({ type: [String], description: "Faltantes (Procura) de notas de venta que esta línea viene a cubrir: se ligan completos." })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  asignacionIds?: string[];

  @ApiPropertyOptional({ default: 0, description: "Unidades de más (para stock) que se suman a lo ligado." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cantidadExtra?: number;
}

export class GrupoCrearCompraDto {
  @ApiProperty({ description: "Proveedor de la nota de compra que se crea." })
  @IsUUID()
  proveedorId!: string;

  @ApiProperty({ type: [LineaCrearCompraDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaCrearCompraDto)
  lineas!: LineaCrearCompraDto[];
}

export class CrearComprasDto {
  @ApiProperty({ type: [GrupoCrearCompraDto], description: "Un grupo por proveedor: se crea una nota de compra (borrador) por grupo." })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GrupoCrearCompraDto)
  grupos!: GrupoCrearCompraDto[];
}
