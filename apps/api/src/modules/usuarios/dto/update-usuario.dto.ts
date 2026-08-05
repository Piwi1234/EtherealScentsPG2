import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from "class-validator";
import { Rol } from "@app/database";

export class UpdateUsuarioDto {
  @ApiPropertyOptional({ example: "Ana Pérez" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @ApiPropertyOptional({ example: "ana@ejemplo.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: "Si se envía, reemplaza la contraseña actual.", example: "NuevaPass1." })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ enum: Rol })
  @IsOptional()
  @IsEnum(Rol)
  rol?: Rol;

  @ApiPropertyOptional({ description: "false = deshabilita el acceso (soft delete usa esto mismo)." })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
