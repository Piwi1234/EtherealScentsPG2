import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { EstadoEnvio } from "@app/database";

export class CreateEnvioDto {
  @ApiProperty({ description: "Almacén al que llega la mercadería de este envío." })
  @IsUUID()
  almacenDestinoId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;

  @ApiPropertyOptional({ type: [String], description: "Compras APROBADAS (sin envío) que arrancan dentro del envío." })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  compraIds?: string[];
}

export class UpdateEnvioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  almacenDestinoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;
}

export class QueryEnvioDto {
  @ApiPropertyOptional({ enum: EstadoEnvio })
  @IsOptional()
  @IsEnum(EstadoEnvio)
  estado?: EstadoEnvio;

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

export class UpdateRecepcionLineaDto {
  @ApiPropertyOptional({ description: "Cantidad que realmente llegó (0 = no llegó)." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cantidadRecibida?: number;

  @ApiPropertyOptional({ description: "Variante que realmente llegó, si fue otra distinta de la esperada." })
  @IsOptional()
  @IsUUID()
  varianteRecibidaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;
}
