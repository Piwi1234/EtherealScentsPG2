import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateContactoInfoDto {
  @ApiPropertyOptional({ example: "+591 700 00000\n+591 800 00000", description: "Uno o más números, uno por línea." })
  @IsOptional()
  @IsString()
  telefonos?: string;

  @ApiPropertyOptional({ example: "hola@etherealscents.com" })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: "Cochabamba, Bolivia" })
  @IsOptional()
  @IsString()
  ciudad?: string;
}
