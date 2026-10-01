import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

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

  @ApiPropertyOptional({
    default: false,
    description: "Si aparece como pill en el buscador \"¿Qué te gusta oler?\" del home (solo Acordes, hoy).",
  })
  @IsOptional()
  @IsBoolean()
  destacadoHome?: boolean;

  @ApiPropertyOptional({ default: 0, description: "Orden entre las opciones destacadas del home (menor primero)." })
  @IsOptional()
  @IsInt()
  ordenDestacado?: number;
}

export class UpdateAttributeOptionDto extends CreateAttributeOptionDto {}
