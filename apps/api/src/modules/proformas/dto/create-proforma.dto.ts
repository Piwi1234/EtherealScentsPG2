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

  @ApiPropertyOptional({ description: "Solo COMPRA: proveedor de la nota (una nota de compra por proveedor). Obligatorio para aprobarla." })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @ApiPropertyOptional({ description: "Solo COMPRA: almacén al que llega la mercadería. Lo recogido sin ligar cuenta como stock en tránsito en ese almacén. Si se omite, el predeterminado." })
  @IsOptional()
  @IsUUID()
  almacenId?: string;

  @ApiPropertyOptional({ description: "Solo aplica a VENTA: dato informativo, sin efecto en la lógica de negocio." })
  @IsOptional()
  @IsUUID()
  ciudadEntregaId?: string;

  @ApiPropertyOptional({
    description: "Solo aplica a COMPRA: tipo de cambio al que se hizo esta compra puntual (para valorar en Bs). Si se omite al crear, se autocompleta con el tipo de cambio del sistema.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tipoCambioProf?: number;

  @ApiPropertyOptional({
    description: "% del total que debe adelantar el cliente. Informativo por ahora, sin ligar a un módulo de pagos.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  adelantoPorcentaje?: number;
}
