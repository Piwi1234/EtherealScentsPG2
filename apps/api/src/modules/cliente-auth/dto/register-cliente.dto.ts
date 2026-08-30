import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";

// No reusa CreateClienteDto (el de gestión) a propósito: ese exige numeroDocumento/tipoDocumento,
// que un alta rápida por Google no puede pedir de entrada.
export class RegisterClienteDto {
  @ApiProperty({ example: "Juan Pérez" })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  nombre!: string;

  @ApiProperty({ example: "juan@ejemplo.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Cliente1." })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telefono?: string;
}
