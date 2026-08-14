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
    description:
      "Obligatorio salvo cuando origen y destino son la misma moneda, o el par tiene tasa fija 1:1 (ver traspaso-conversion.util.ts).",
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
