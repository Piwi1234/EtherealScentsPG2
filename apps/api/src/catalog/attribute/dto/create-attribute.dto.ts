import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AttributeType } from "@app/database";
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
