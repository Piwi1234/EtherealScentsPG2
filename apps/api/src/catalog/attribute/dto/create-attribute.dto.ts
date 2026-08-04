import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from "class-validator";
import { AttributeType, AttributeVariantMode } from "@app/database";

export class CreateAttributeOptionInputDto {
  @ApiProperty({ example: "AMADERADO" })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({ example: "#c9a96e", description: "Color hex del botón de esta opción en el formulario de producto." })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "color debe ser un hex válido, ej. #c9a96e" })
  color?: string;
}

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
      "Solo válido cuando type='select'. NONE: valor único de siempre (o varios si allowMultiple). " +
      "MULTI_VALUE: el producto arma su propia lista de valores, no afecta el precio (ej. sabores). " +
      "PRICED_VARIANT: cada valor propio del producto genera una variante con su propio precio.",
  })
  @IsOptional()
  @IsEnum(AttributeVariantMode)
  variantMode?: AttributeVariantMode;

  @ApiPropertyOptional({
    default: false,
    description:
      "Solo válido cuando type='select' y variantMode='NONE'. El producto puede elegir 1 o más " +
      "opciones de la lista compartida de la categoría (ej. Acordes de un perfume), para poder " +
      "filtrar por ellas más adelante.",
  })
  @IsOptional()
  @IsBoolean()
  allowMultiple?: boolean;

  @ApiPropertyOptional({
    type: [CreateAttributeOptionInputDto],
    description: "Requerido y solo válido cuando type='select' y variantMode='NONE'. Opciones iniciales de la lista.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((o: CreateAttributeOptionInputDto) => o.value)
  @ValidateNested({ each: true })
  @Type(() => CreateAttributeOptionInputDto)
  options?: CreateAttributeOptionInputDto[];
}
