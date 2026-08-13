import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateCiudadProcedenciaDto {
  @ApiProperty({ example: "Guangzhou" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;
}
