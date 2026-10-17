import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class AddRelacionadaDto {
  @ApiProperty({ description: "Id de la historia a vincular como relacionada (vínculo recíproco)." })
  @IsUUID()
  relacionadaId!: string;
}
