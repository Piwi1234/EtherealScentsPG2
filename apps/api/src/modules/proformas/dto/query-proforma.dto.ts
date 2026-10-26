import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { EstadoProforma, TipoProforma } from "@app/database";

export class QueryProformaDto {
  @ApiPropertyOptional({ enum: TipoProforma })
  @IsOptional()
  @IsEnum(TipoProforma)
  tipo?: TipoProforma;

  @ApiPropertyOptional({ description: "Código corto mostrado en la UI (ej. \"4HRNPZW\"), búsqueda exacta sin importar mayúsculas." })
  @IsOptional()
  @IsString()
  codigo?: string;

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

  @ApiPropertyOptional({ description: "Solo COMPRA: proformas que tengan al menos una línea de este proveedor (el proveedor es por línea, no por documento)." })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @ApiPropertyOptional({ description: "Solo VENTA: ciudad de entrega puntual." })
  @IsOptional()
  @IsUUID()
  ciudadEntregaId?: string;

  @ApiPropertyOptional({ description: "Filtra por quién la creó (el \"Vendedor\" en el listado de VENTA)." })
  @IsOptional()
  @IsUUID()
  creadoPorId?: string;

  @ApiPropertyOptional({
    enum: ["LISTA", "ESPERANDO"],
    description:
      "Solo VENTA aprobada. LISTA: todo reservado en stock físico (se puede completar). ESPERANDO: tiene faltante o reservas en tránsito sin llegar.",
  })
  @IsOptional()
  @IsIn(["LISTA", "ESPERANDO"])
  entrega?: "LISTA" | "ESPERANDO";

  @ApiPropertyOptional({ description: "Solo COMPRA: proformas que todavía no están en ningún envío." })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  sinEnvio?: boolean;

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
