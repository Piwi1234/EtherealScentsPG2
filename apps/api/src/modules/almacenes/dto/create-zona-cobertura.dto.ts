import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsUUID, Min } from "class-validator";

export class CreateZonaCoberturaDto {
  @ApiProperty()
  @IsUUID()
  ciudadId!: string;

  @ApiProperty()
  @IsUUID()
  almacenId!: string;

  @ApiProperty({ example: 1, description: "1 = más prioritario/cercano." })
  @IsInt()
  @Min(1)
  prioridad!: number;
}
