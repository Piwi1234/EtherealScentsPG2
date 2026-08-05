import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from "class-validator";
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
