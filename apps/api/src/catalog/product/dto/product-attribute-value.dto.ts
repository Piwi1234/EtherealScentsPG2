import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class ProductAttributeValueInputDto {
  @IsUUID()
  attributeId!: string;

  @ApiPropertyOptional({ description: "Para atributos type='text'." })
  @IsOptional()
  @IsString()
  valueText?: string;

  @ApiPropertyOptional({ description: "Para atributos type='number'." })
  @IsOptional()
  @IsNumber()
  valueNumber?: number;

  @ApiPropertyOptional({ description: "Para atributos type='boolean'." })
  @IsOptional()
  @IsBoolean()
  valueBoolean?: boolean;

  @ApiPropertyOptional({ description: "Id de AttributeOption, para atributos type='select'." })
  @IsOptional()
  @IsUUID()
  optionId?: string;
}
