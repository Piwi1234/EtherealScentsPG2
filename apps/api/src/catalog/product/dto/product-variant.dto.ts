import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsUUID, Min, ValidateNested } from "class-validator";

export class VariantOptionInputDto {
  @ApiProperty({ description: "Id de un atributo con precio propio (variantMode='PRICED_VARIANT') de la categoría." })
  @IsUUID()
  attributeId!: string;

  @ApiProperty({ description: "Id de la opción elegida para ese atributo." })
  @IsUUID()
  optionId!: string;
}

export class CreateProductVariantDto {
  @ApiProperty({ example: 12, description: "Precio de compra propio de esta variante." })
  @IsNumber()
  @IsPositive()
  purchasePrice!: number;

  @ApiPropertyOptional({ example: 5, default: 0, description: "Utilidad propia de esta variante." })
  @IsOptional()
  @IsNumber()
  utility?: number;

  @ApiPropertyOptional({ example: 350, description: "Precio Min Bs (manual) propio de esta variante." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPriceBs?: number;

  @ApiPropertyOptional({ example: 20, default: 0, description: "Descuento en bolívares propio de esta variante." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountBs?: number;

  @ApiProperty({
    type: [VariantOptionInputDto],
    description: "Combinación de valores (uno por cada atributo con precio propio) que define esta variante.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VariantOptionInputDto)
  options!: VariantOptionInputDto[];
}

export class UpdateProductVariantDto extends PartialType(CreateProductVariantDto) {}
