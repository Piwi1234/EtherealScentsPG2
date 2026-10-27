import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { TipoProforma } from "@app/database";

export class QueryRegistrosDto {
  @ApiProperty({ enum: TipoProforma, description: "COMPRA o VENTA — obligatorio, es el filtro que habilita la carga." })
  @IsEnum(TipoProforma)
  tipo!: TipoProforma;

  @ApiPropertyOptional({
    enum: ["BORRADOR", "APROBADA", "COMPLETADA", "ANULADA"],
    description: "Solo las proformas en ese estado; sin valor trae aprobadas y completadas (o borradores y anuladas con sinConcretar).",
  })
  @IsOptional()
  @IsIn(["BORRADOR", "APROBADA", "COMPLETADA", "ANULADA"])
  estado?: "BORRADOR" | "APROBADA" | "COMPLETADA" | "ANULADA";

  @ApiPropertyOptional({
    description: "true: lo que no se concretó (borradores y anuladas) en vez de lo real (aprobadas y completadas). Un `estado` explícito manda sobre esto.",
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  sinConcretar?: boolean;

  @ApiPropertyOptional({ description: "Pagina por PROFORMA (page/limit cuentan proformas) y trae todas las líneas de cada una." })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  porProforma?: boolean;

  @ApiPropertyOptional({ enum: ["LISTA", "ESPERANDO"], description: "Solo ventas aprobadas: listas para completar o esperando mercadería (faltante o tránsito)." })
  @IsOptional()
  @IsIn(["LISTA", "ESPERANDO"])
  entrega?: "LISTA" | "ESPERANDO";

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

  @ApiPropertyOptional({
    description: "Búsqueda por texto, igual que en Productos: cada palabra debe coincidir con el nombre, el código o la marca (todas las palabras a la vez).",
  })
  @IsOptional()
  @IsString()
  search?: string;

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
