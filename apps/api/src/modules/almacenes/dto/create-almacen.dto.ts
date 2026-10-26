import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateAlmacenDto {
  @ApiProperty({ example: "Almacén Central" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiPropertyOptional({ description: "Almacén que se preselecciona siempre que se pida uno (solo uno a la vez)." })
  @IsOptional()
  @IsBoolean()
  predeterminado?: boolean;
}
