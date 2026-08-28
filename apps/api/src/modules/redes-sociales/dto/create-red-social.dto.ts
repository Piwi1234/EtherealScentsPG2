import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUrl } from "class-validator";

export class CreateRedSocialDto {
  @ApiProperty({ example: "Instagram" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiProperty({ example: "https://instagram.com/etherealscents" })
  @IsUrl()
  url!: string;
}
