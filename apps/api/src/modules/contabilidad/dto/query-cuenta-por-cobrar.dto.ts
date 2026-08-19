import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Min } from "class-validator";
import { EstadoCuentaPorCobrar } from "@app/database";

export class QueryCuentaPorCobrarDto {
  @ApiPropertyOptional({ enum: EstadoCuentaPorCobrar, description: "Si se omite, trae ambos estados." })
  @IsOptional()
  @IsEnum(EstadoCuentaPorCobrar)
  estado?: EstadoCuentaPorCobrar;

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
