import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { TipoCliente, TipoDocumento } from "@app/database";

export class CreateClienteDto {
  @ApiPropertyOptional({ enum: TipoCliente, default: TipoCliente.NATURAL })
  @IsOptional()
  @IsEnum(TipoCliente)
  tipo?: TipoCliente;

  @ApiProperty({ example: "Juan Pérez" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiProperty({ enum: TipoDocumento, example: TipoDocumento.CI })
  @IsEnum(TipoDocumento)
  tipoDocumento!: TipoDocumento;

  @ApiProperty({ example: "V-12345678", description: "String, no numérico: RUC/pasaporte pueden incluir letras." })
  @IsString()
  @IsNotEmpty()
  numeroDocumento!: string;

  @ApiPropertyOptional({ example: "juan@ejemplo.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ciudad?: string;
}
