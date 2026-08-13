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

  @ApiPropertyOptional({ description: "Solo aplica a VENTA: dato informativo, sin efecto en la lógica de negocio." })
  @IsOptional()
  @IsUUID()
  ciudadEntregaId?: string;

  @ApiPropertyOptional({ description: "Solo aplica a COMPRA: de dónde viene la mercadería, informativo." })
  @IsOptional()
  @IsUUID()
  ciudadProcedenciaId?: string;

  @ApiPropertyOptional({
    description: "Solo aplica a COMPRA: tipo de cambio al que se hizo esta compra puntual (para valorar en Bs). Si se omite al crear, se autocompleta con el tipo de cambio del sistema.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tipoCambioProf?: number;

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
