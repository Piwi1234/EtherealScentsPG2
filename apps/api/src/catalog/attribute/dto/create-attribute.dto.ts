import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AttributeType, AttributeVariantMode } from "@app/database";
import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateAttributeDto {
  @ApiProperty({ example: "Almacenamiento" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: AttributeType, example: AttributeType.SELECT })
  @IsEnum(AttributeType)
  type!: AttributeType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: "Si se muestra como columna extra en la tabla de Productos del panel (además de las de siempre).",
  })
  @IsOptional()
  @IsBoolean()
  showInProductList?: boolean;

  @ApiPropertyOptional({
    enum: AttributeVariantMode,
    default: AttributeVariantMode.NONE,
    description:
      "Solo válido cuando type='select'. NONE: valor único de siempre. MULTI_VALUE: el producto puede " +
      "tener 1 o más valores, no afecta el precio (ej. sabores). PRICED_VARIANT: cada valor elegido " +
      "genera una variante con su propio precio de compra/utilidad/ID de producto (ej. tamaño).",
  })
  @IsOptional()
  @IsEnum(AttributeVariantMode)
  variantMode?: AttributeVariantMode;

  @ApiPropertyOptional({
    type: [String],
    description: "Requerido y solo válido cuando type='select'. Valores iniciales de la lista de opciones.",
    example: ["64GB", "128GB", "256GB"],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  options?: string[];
}
