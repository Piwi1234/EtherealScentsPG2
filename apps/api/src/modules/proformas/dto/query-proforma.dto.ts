import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Min } from "class-validator";
import { EstadoProforma, TipoProforma } from "@app/database";

export class QueryProformaDto {
  @ApiPropertyOptional({ enum: TipoProforma })
  @IsOptional()
  @IsEnum(TipoProforma)
  tipo?: TipoProforma;

  @ApiPropertyOptional({ enum: EstadoProforma })
  @IsOptional()
  @IsEnum(EstadoProforma)
  estado?: EstadoProforma;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @ApiPropertyOptional({ description: "Solo VENTA: pedidos de un cliente puntual." })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiPropertyOptional({ description: "Solo COMPRA: pedidos de un proveedor puntual." })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @ApiPropertyOptional({ description: "Solo VENTA: ciudad de entrega puntual." })
  @IsOptional()
  @IsUUID()
  ciudadEntregaId?: string;

  @ApiPropertyOptional({ description: "Solo COMPRA: país de procedencia puntual." })
  @IsOptional()
  @IsUUID()
  paisProcedenciaId?: string;

  @ApiPropertyOptional({ description: "Filtra por quién la creó (el \"Vendedor\" en el listado de VENTA)." })
  @IsOptional()
  @IsUUID()
  creadoPorId?: string;

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
