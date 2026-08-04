import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class CreateVariantOptionValueDto {
  @ApiProperty({ description: "Id de un atributo con variante (MULTI_VALUE o PRICED_VARIANT) de la categoría del producto." })
  @IsUUID()
  attributeId!: string;

  @ApiProperty({ example: "Menta" })
  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class UpdateVariantOptionValueDto {
  @ApiProperty({ example: "Menta" })
  @IsString()
  @IsNotEmpty()
  value!: string;
}
