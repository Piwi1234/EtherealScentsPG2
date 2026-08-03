import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, ValidateNested } from "class-validator";
import { ProductAttributeValueInputDto } from "./product-attribute-value.dto";

export class CreateProductDto {
  @ApiProperty({ example: "Samsung Galaxy S24" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "SAM-S24-128" })
  @IsString()
  @IsNotEmpty()
  sku!: string;

  @ApiProperty({ example: 899.99 })
  @IsNumber()
  @IsPositive()
  price!: number;

  @ApiPropertyOptional({ example: 25, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

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
