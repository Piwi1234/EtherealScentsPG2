import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, ValidateNested } from "class-validator";
import { ProductAttributeValueInputDto } from "./product-attribute-value.dto";

export class CreateProductDto {
  @ApiProperty({ example: "Samsung Galaxy S24" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 650, description: "Precio de compra (costo de adquisición). Base de la fórmula de precio $." })
  @IsNumber()
  @IsPositive()
  purchasePrice!: number;

  @ApiPropertyOptional({ example: 50, default: 0, description: "Utilidad cargada manualmente." })
  @IsOptional()
  @IsNumber()
  utility?: number;

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
