import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsUUID, Min } from "class-validator";

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

  @ApiPropertyOptional({
    description: "Opcional, junto con carteraId: monto realmente cobrado como adelanto (Bs). Si no se manda, se cobra el monto calculado por el porcentaje. Puede ser menor o mayor, hasta el total de la venta.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  montoAdelanto?: number;
}
