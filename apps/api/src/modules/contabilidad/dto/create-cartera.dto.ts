import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";
import { MonedaCartera } from "@app/database";

export class CreateCarteraDto {
  @ApiProperty({ enum: MonedaCartera })
  @IsEnum(MonedaCartera)
  moneda!: MonedaCartera;

  @ApiProperty({ example: "Caja principal" })
  @IsString()
  @IsNotEmpty()
  nombre!: string;
}
