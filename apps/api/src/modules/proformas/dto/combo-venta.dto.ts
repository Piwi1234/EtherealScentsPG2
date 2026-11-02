import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsUUID, Max, Min } from "class-validator";

export class AddComboVentaDto {
  @ApiProperty({ description: "Combo a vender (ver Combo en schema.prisma)." })
  @IsUUID()
  comboId!: string;

  @ApiProperty({ example: 1, description: "Cuántos combos completos se agregan." })
  @IsInt()
  @Min(1)
  @Max(99)
  cantidad!: number;
}

export class SetComboCantidadDto {
  @ApiProperty({ example: 2, description: "Cantidad de combos completos que lleva la nota." })
  @IsInt()
  @Min(1)
  @Max(99)
  cantidad!: number;
}
