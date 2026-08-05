import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";
import { TipoEmpresa } from "@app/database";

export class CreateEmpresaDto {
  @ApiProperty({ example: "Perfumería Central" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiProperty({ enum: TipoEmpresa, example: TipoEmpresa.CASA_MATRIZ })
  @IsEnum(TipoEmpresa)
  tipo!: TipoEmpresa;

  @ApiProperty({ example: "Perfumería Central C.A." })
  @IsString()
  @IsNotEmpty()
  razonSocial!: string;

  @ApiProperty({ example: "J-12345678-9" })
  @IsString()
  @IsNotEmpty()
  nit!: string;

  @ApiPropertyOptional({ example: "https://ejemplo.com/logo.png" })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;
}
