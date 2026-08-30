import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginClienteDto {
  @ApiProperty({ example: "juan@ejemplo.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Cliente1." })
  @IsString()
  @MinLength(8)
  password!: string;
}
