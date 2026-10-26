import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from "class-validator";

export class LineaSolicitudDto {
  @ApiProperty()
  @IsUUID()
  varianteId!: string;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nota?: string;
}

export class CreateSolicitudDto {
  @ApiPropertyOptional({ description: "Para qué se pide este stock (ej. reposición de temporada)." })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;

  @ApiPropertyOptional({ type: [LineaSolicitudDto], description: "Líneas iniciales; también se pueden agregar después." })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LineaSolicitudDto)
  lineas?: LineaSolicitudDto[];
}

export class UpdateSolicitudDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;
}

export class UpdateLineaSolicitudDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nota?: string;
}

export class VincularLineaSolicitudDto {
  @ApiProperty({ description: "Línea de COMPRA que viene a cubrir esta línea de la solicitud." })
  @IsUUID()
  compraDetalleId!: string;

  @ApiPropertyOptional({ description: "Unidades que cubre; sin valor se liga lo máximo que cabe. Si es menor, la línea se parte." })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad?: number;
}

export class QuerySolicitudDto {
  @ApiPropertyOptional({ enum: ["ABIERTA", "CERRADA", "CANCELADA"] })
  @IsOptional()
  @IsIn(["ABIERTA", "CERRADA", "CANCELADA"])
  estado?: "ABIERTA" | "CERRADA" | "CANCELADA";

  @ApiPropertyOptional({ description: "Código de la solicitud o nombre del producto." })
  @IsOptional()
  @IsString()
  search?: string;

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
