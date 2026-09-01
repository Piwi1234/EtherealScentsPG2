import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({ example: "juan@ejemplo.com" })
  @IsEmail()
  email!: string;
}
