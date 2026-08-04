import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsUUID, Min } from "class-validator";

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
    type: [String],
    description:
      "IDs de ProductVariantOptionValue (propios de este producto, uno por cada atributo con precio " +
      "propio de su categoría) que definen esta variante.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  optionValueIds!: string[];
}

export class UpdateProductVariantDto extends PartialType(CreateProductVariantDto) {}
