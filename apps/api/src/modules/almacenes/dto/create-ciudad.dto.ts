import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateCiudadDto {
  @ApiProperty({ example: "Caracas" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;
}
