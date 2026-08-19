import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsUUID, Min } from "class-validator";

export class CobrarCuentaDto {
  @ApiProperty({ description: "Monto a cobrar ahora, en Bs. No puede superar el saldo adeudado." })
  @IsNumber()
  @Min(0.01)
  monto!: number;

  @ApiProperty({ description: "Cartera en Bs donde se registra el ingreso." })
  @IsUUID()
  carteraId!: string;
}
