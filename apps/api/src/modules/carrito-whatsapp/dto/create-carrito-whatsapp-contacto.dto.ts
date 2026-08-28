import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateCarritoWhatsappContactoDto {
  @ApiProperty({ example: "Ana Pérez" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiProperty({ example: "59167696116" })
  @IsString()
  @IsNotEmpty()
  whatsapp!: string;

  @ApiPropertyOptional({ example: "Atiende perfumes y vapes." })
  @IsOptional()
  @IsString()
  descripcion?: string;
}
