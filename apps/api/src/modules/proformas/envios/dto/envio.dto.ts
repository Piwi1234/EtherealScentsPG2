import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from "class-validator";
import { EstadoEnvio } from "@app/database";

export class EnvioItemDto {
  @ApiProperty({ description: "Línea de compra (ya recogida) que viaja en el envío." })
  @IsUUID()
  compraDetalleId!: string;

  @ApiProperty({ description: "Unidades de esa línea que viajan en este envío." })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class CreateEnvioDto {
  @ApiProperty({ description: "Almacén al que llega la mercadería de este envío." })
  @IsUUID()
  almacenDestinoId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;

  @ApiPropertyOptional({ type: [EnvioItemDto], description: "Productos recogidos que arrancan dentro del envío." })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnvioItemDto)
  items?: EnvioItemDto[];
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

export class UpdateEnvioItemDto {
  @ApiProperty({ description: "Nueva cantidad que viaja en el envío." })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;
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

export class RecepcionItemDto {
  @ApiProperty()
  @IsUUID()
  envioItemId!: string;

  @ApiProperty({ description: "Unidades que llegaron en esta recepción." })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;

  @ApiPropertyOptional({ description: "Variante que realmente llegó, si fue otra distinta de la esperada." })
  @IsOptional()
  @IsUUID()
  varianteRecibidaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;
}

export class CreateRecepcionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;

  @ApiProperty({ type: [RecepcionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecepcionItemDto)
  items!: RecepcionItemDto[];
}
