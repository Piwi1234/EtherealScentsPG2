import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from "class-validator";
import { Rol } from "@app/database";

export class CreateUsuarioDto {
  @ApiProperty({ example: "Ana Pérez" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiProperty({ example: "ana@ejemplo.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Password1." })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: Rol, example: Rol.SELLER })
  @IsEnum(Rol)
  rol!: Rol;
}
