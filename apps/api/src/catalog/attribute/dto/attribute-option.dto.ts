import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class CreateAttributeOptionDto {
  @ApiProperty({ example: "128GB" })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({ example: "#c9a96e", description: "Color hex del botón de esta opción en el formulario de producto." })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "color debe ser un hex válido, ej. #c9a96e" })
  color?: string;
}

export class UpdateAttributeOptionDto extends CreateAttributeOptionDto {}
