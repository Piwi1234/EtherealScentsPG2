import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class UpdateZonaCoberturaDto {
  @ApiProperty({ example: 1, description: "1 = más prioritario/cercano." })
  @IsInt()
  @Min(1)
  prioridad!: number;
}
