import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsUUID, Max, Min } from "class-validator";
import { TipoProforma } from "@app/database";

export class CreateProformaDto {
  @ApiProperty({ enum: TipoProforma })
  @IsEnum(TipoProforma)
  tipo!: TipoProforma;

  @ApiProperty()
  @IsUUID()
  empresaId!: string;

  @ApiPropertyOptional({ description: "Obligatorio si tipo = VENTA." })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiPropertyOptional({ description: "Obligatorio si tipo = COMPRA: a qué almacén entra la mercadería." })
  @IsOptional()
  @IsUUID()
  almacenRecepcionId?: string;

  @ApiPropertyOptional({ description: "Solo aplica a VENTA: determina el reparto por cercanía al aprobar." })
  @IsOptional()
  @IsUUID()
  ciudadEntregaId?: string;

  @ApiPropertyOptional({ default: 0, description: "Aplica sobre el total del documento, no por línea." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  descuentoGeneral?: number;

  @ApiPropertyOptional({
    description: "% del total que debe adelantar el cliente. Informativo por ahora, sin ligar a un módulo de pagos.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  adelantoPorcentaje?: number;
}
