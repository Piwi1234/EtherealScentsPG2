import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Min } from "class-validator";

export class VincularCompraDto {
  @ApiProperty({ description: "Línea de COMPRA que viene a cubrir este faltante." })
  @IsUUID()
  compraDetalleId!: string;

  @ApiPropertyOptional({
    description:
      "Unidades del faltante que esta línea de compra cubre. Sin valor se liga lo máximo posible (el faltante entero o lo que le quede libre a la compra). Si es menor al faltante, el faltante se parte y el resto queda libre para otras compras.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad?: number;
}
