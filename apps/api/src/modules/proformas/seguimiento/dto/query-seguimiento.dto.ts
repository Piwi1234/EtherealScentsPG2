import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from "class-validator";
import { EstadoSeguimiento, TipoProforma } from "@app/database";

export class QuerySeguimientoDto {
  @ApiPropertyOptional({ enum: EstadoSeguimiento, description: "Estado actual (el más reciente registrado por línea)." })
  @IsOptional()
  @IsEnum(EstadoSeguimiento)
  estado?: EstadoSeguimiento;

  @ApiPropertyOptional({ enum: TipoProforma })
  @IsOptional()
  @IsEnum(TipoProforma)
  tipo?: TipoProforma;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  empresaId?: string;

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
