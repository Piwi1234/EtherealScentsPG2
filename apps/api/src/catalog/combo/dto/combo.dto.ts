import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class ComboItemDto {
  @ApiProperty({ description: "Variante del componente (en productos simples, su variante auto-provista)." })
  @IsUUID()
  varianteId!: string;

  @ApiProperty({ example: 1, description: "Unidades de esa variante que lleva el combo." })
  @IsInt()
  @Min(1)
  @Max(10)
  cantidad!: number;
}

export class CreateComboDto {
  @ApiProperty({ example: "Combo Árabes Dúo" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @ApiProperty({ description: "Categoría del combo: todos sus componentes tienen que ser de esa categoría (o de sus subcategorías)." })
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;

  @ApiPropertyOptional({ example: 50, description: "Descuento fijo en Bs sobre la suma de los precios de venta de los componentes." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuentoBs?: number;

  @ApiPropertyOptional({ description: "Si se muestra en la web pública." })
  @IsOptional()
  @IsBoolean()
  publicado?: boolean;

  @ApiProperty({ type: [ComboItemDto], description: "Entre 2 y 4 variantes distintas." })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ComboItemDto)
  items!: ComboItemDto[];
}

export class UpdateComboDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuentoBs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  publicado?: boolean;

  @ApiPropertyOptional({ type: [ComboItemDto], description: "Si viene, reemplaza todos los componentes." })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => ComboItemDto)
  items?: ComboItemDto[];
}
