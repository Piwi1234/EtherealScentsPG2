import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

export class AddDetalleVentaDto {
  @ApiProperty()
  @IsUUID()
  varianteId!: string;

  @ApiPropertyOptional({
    example: 1,
    description: "Requerida salvo que se venda por presentacionVentaId (variante unidad=ML), donde se resuelve sola.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad?: number;

  @ApiPropertyOptional({ description: "Si se omite, nace de ProductVariant.precioFinalBs calculado en vivo." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioUnitario?: number;

  @ApiPropertyOptional({
    description:
      "Venta fraccionada: id de la PresentacionVenta elegida (debe pertenecer a varianteId, que debe ser unidad=ML). " +
      "Junto con numPresentaciones, resuelve cantidad y precioUnitario — ignora esos dos campos si vienen.",
  })
  @IsOptional()
  @IsUUID()
  presentacionVentaId?: string;

  @ApiPropertyOptional({ example: 2, description: "Cantidad de la presentación elegida (obligatorio junto con presentacionVentaId)." })
  @IsOptional()
  @IsInt()
  @Min(1)
  numPresentaciones?: number;
}
