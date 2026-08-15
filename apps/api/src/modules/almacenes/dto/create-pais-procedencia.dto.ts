import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreatePaisProcedenciaDto {
  @ApiProperty({ example: "China" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;
}
