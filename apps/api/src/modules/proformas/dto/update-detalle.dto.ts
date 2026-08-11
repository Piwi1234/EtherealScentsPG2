import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

/**
 * Único DTO para editar una línea, sea de VENTA o de COMPRA — el servicio valida qué campos aplican
 * según el tipo de la proforma padre (precioUnitario para VENTA; los 4 costos para COMPRA).
 */
export class UpdateDetalleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  cantidad?: number;

  @ApiPropertyOptional({ description: "Solo VENTA." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioUnitario?: number;

  @ApiPropertyOptional({ description: "Solo VENTA: almacén del que se intenta reservar stock al aprobar." })
  @IsOptional()
  @IsUUID()
  almacenId?: string;

  @ApiPropertyOptional({ description: "Solo COMPRA." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioCompra?: number;

  @ApiPropertyOptional({ description: "Solo COMPRA." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costoEnvio?: number;

  @ApiPropertyOptional({ description: "Solo COMPRA." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costoSeguridad?: number;

  @ApiPropertyOptional({ description: "Solo COMPRA." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costoLogistica?: number;
}
