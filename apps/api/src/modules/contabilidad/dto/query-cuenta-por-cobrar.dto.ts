import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { EstadoCuentaPorCobrar } from "@app/database";

export class QueryCuentaPorCobrarDto {
  @ApiPropertyOptional({ enum: EstadoCuentaPorCobrar, description: "Si se omite, trae ambos estados." })
  @IsOptional()
  @IsEnum(EstadoCuentaPorCobrar)
  estado?: EstadoCuentaPorCobrar;

  @ApiPropertyOptional({ description: "Cliente puntual (Proforma.clienteId)." })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

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
