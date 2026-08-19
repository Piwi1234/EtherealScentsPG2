import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { TipoProforma } from "@app/database";

export class QueryRegistrosDto {
  @ApiProperty({ enum: TipoProforma, description: "COMPRA o VENTA — obligatorio, es el filtro que habilita la carga." })
  @IsEnum(TipoProforma)
  tipo!: TipoProforma;

  @ApiPropertyOptional({ description: "Código corto de la proforma (Proforma.codigo), búsqueda exacta sin importar mayúsculas." })
  @IsOptional()
  @IsString()
  codigo?: string;

  @ApiPropertyOptional({ description: "Rango de fechas: desde (inclusive), sobre Proforma.fecha." })
  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @ApiPropertyOptional({ description: "Rango de fechas: hasta (inclusive, se extiende al final de ese día)." })
  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @ApiPropertyOptional({ description: "Categoría padre — se expande a ella + todas sus subcategorías." })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ description: "Producto específico (no variante)." })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: "Solo VENTA: pedidos de un cliente puntual." })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiPropertyOptional({ description: "Solo COMPRA: pedidos de un proveedor puntual." })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

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
