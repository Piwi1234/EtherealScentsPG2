import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class AprobarProformaDto {
  @ApiPropertyOptional({ description: "Obligatorio si la proforma es de VENTA: almacén contra el que se reserva stock." })
  @IsOptional()
  @IsUUID()
  almacenId?: string;

  @ApiPropertyOptional({
    description:
      "Obligatorio si la proforma de VENTA tiene adelanto (adelantoPorcentaje > 0): cartera en Bs donde se registra el ingreso del adelanto.",
  })
  @IsOptional()
  @IsUUID()
  carteraId?: string;
}
