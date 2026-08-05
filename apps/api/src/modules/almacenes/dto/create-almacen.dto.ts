import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class CreateAlmacenDto {
  @ApiProperty({ example: "Almacén Central" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiProperty()
  @IsUUID()
  ciudadId!: string;
}
