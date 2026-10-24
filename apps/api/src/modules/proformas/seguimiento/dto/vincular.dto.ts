import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class VincularCompraDto {
  @ApiProperty({ description: "Línea de COMPRA (destino PEDIDO) que viene a cubrir este faltante." })
  @IsUUID()
  compraDetalleId!: string;
}
