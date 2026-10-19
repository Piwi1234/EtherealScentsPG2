import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";

export class UpdateContactoInfoDto {
  @ApiPropertyOptional({ example: ["+591 700 00000", "+591 800 00000"], description: "Números individuales, cada uno con su propio link a WhatsApp en el footer." })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  telefonos?: string[];

  @ApiPropertyOptional({ example: "hola@etherealscents.com" })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: "Cochabamba, Bolivia" })
  @IsOptional()
  @IsString()
  ciudad?: string;

  @ApiPropertyOptional({ example: "https://chat.whatsapp.com/xxxxx", description: "A dónde redirige el botón 'Canal de ofertas' del Newsletter." })
  @IsOptional()
  @IsString()
  canalOfertasUrl?: string;
}
