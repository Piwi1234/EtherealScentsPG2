import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateAlmacenDto {
  @ApiProperty({ example: "Almacén Central" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;
}
