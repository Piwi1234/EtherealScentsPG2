import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class AddSugerenciaProductoDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;
}
