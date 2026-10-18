import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { TipoCliente } from "@app/database";

export class CreateClienteDto {
  @ApiPropertyOptional({ enum: TipoCliente, default: TipoCliente.NATURAL })
  @IsOptional()
  @IsEnum(TipoCliente)
  tipo?: TipoCliente;

  @ApiProperty({ example: "Juan Pérez" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

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
  ciudad?: string;

  @ApiPropertyOptional({ description: "Referencia a la tabla Ciudad (para Proformas). Independiente del campo 'ciudad' de texto libre." })
  @IsOptional()
  @IsUUID()
  ciudadId?: string;
}
