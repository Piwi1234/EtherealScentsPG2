import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class AprobarProformaDto {
  @ApiPropertyOptional({ description: "Obligatorio si la proforma es de VENTA: almacén contra el que se reserva stock." })
  @IsOptional()
  @IsUUID()
  almacenId?: string;

  @ApiPropertyOptional({
    description:
      "Opcional. Si la VENTA tiene adelanto (adelantoPorcentaje > 0) y se manda, el adelanto se cobra en esa cartera (Bs) al aprobar; si no, queda pendiente y se cobra después desde los pagos de la proforma.",
  })
  @IsOptional()
  @IsUUID()
  carteraId?: string;
}
