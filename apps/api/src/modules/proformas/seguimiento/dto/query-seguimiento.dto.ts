import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Min } from "class-validator";

/** Estado DERIVADO de un pedido de cliente (Procura) según la compra/envío que lo cubre — ya no es una
 * etiqueta manual. SIN_COMPRA: nada ligado (o la compra ligada ya cerró sin cubrirlo). */
export const ESTADOS_PEDIDO = ["SIN_COMPRA", "EN_PREPARACION", "COMPRADO", "EN_TRANSITO"] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export class QuerySeguimientoDto {
  @ApiPropertyOptional({ enum: ESTADOS_PEDIDO })
  @IsOptional()
  @IsIn(ESTADOS_PEDIDO)
  estado?: EstadoPedido;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
