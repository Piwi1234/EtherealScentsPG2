import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, ValidateNested } from "class-validator";
import { ProductAttributeValueInputDto } from "./product-attribute-value.dto";

export class CreateProductDto {
  @ApiProperty({ example: "Samsung Galaxy S24" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: 650,
    description:
      "Precio de compra (costo de adquisición). Obligatorio salvo que la categoría tenga algún atributo con " +
      "precio propio (PRICED_VARIANT): en ese caso el precio se carga por variante y este campo es redundante.",
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  purchasePrice?: number;

  @ApiPropertyOptional({ example: 50, default: 0, description: "Utilidad cargada manualmente." })
  @IsOptional()
  @IsNumber()
  utility?: number;

  @ApiPropertyOptional({
    example: 350,
    description:
      "\"Add May\" (manual): monto que se suma a Precio May Bs para armar Precio Final Bs. Igual que " +
      "purchasePrice, si la categoría tiene atributos con precio propio se carga por variante en su lugar.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPriceBs?: number;

  @ApiPropertyOptional({ example: 20, default: 0, description: "Descuento en bolívares, cargado manualmente." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountBs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiPropertyOptional({ type: [ProductAttributeValueInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeValueInputDto)
  attributeValues?: ProductAttributeValueInputDto[];
}
