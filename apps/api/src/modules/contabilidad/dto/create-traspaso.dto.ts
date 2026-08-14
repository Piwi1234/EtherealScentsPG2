import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class CreateTraspasoDto {
  @ApiProperty()
  @IsUUID()
  carteraOrigenId!: string;

  @ApiProperty()
  @IsUUID()
  carteraDestinoId!: string;

  @ApiProperty({ description: "Monto que sale de la cartera origen, en su propia moneda." })
  @IsNumber()
  @Min(0.01)
  montoOrigen!: number;

  @ApiPropertyOptional({
    description: "Obligatorio si origen y destino tienen monedas distintas. montoDestino = montoOrigen * tipoCambio.",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tipoCambio?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;
}
