import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Max, Min, MinLength, ValidateNested } from "class-validator";
import { TipoDescuentoCampana } from "@app/database";

export class AlcanceCampanaDto {
  @ApiPropertyOptional({ description: "Categoría (incluye sus subcategorías)." })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID(undefined, { each: true })
  brandIds?: string[];

  @ApiPropertyOptional({ type: [String], description: "Códigos de producto (lista pegada o subida)." })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  codigos?: string[];
}

export class OpcionesCampanaDto {
  @ApiPropertyOptional({ description: "No tocar los que ya tienen descuento propio." })
  @IsOptional()
  @IsBoolean()
  excluirConDescuento?: boolean;

  @ApiPropertyOptional({ description: "Dejar fuera las variantes NO_DISPONIBLE." })
  @IsOptional()
  @IsBoolean()
  soloDisponibles?: boolean;

  @ApiPropertyOptional({ description: "El precio no baja del costo + este % de margen." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  margenMinimoPct?: number;
}

/** Lo que define el descuento de una campaña: sirve tanto para la vista previa como para crearla. */
export class VistaPreviaCampanaDto {
  @ApiProperty({ enum: TipoDescuentoCampana })
  @IsEnum(TipoDescuentoCampana)
  tipoDescuento!: TipoDescuentoCampana;

  @ApiPropertyOptional({ description: "Porcentaje (1–90) o monto en Bs por unidad. Obligatorio salvo en NINGUNO." })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  valor?: number;

  @ApiPropertyOptional({ type: AlcanceCampanaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AlcanceCampanaDto)
  alcance?: AlcanceCampanaDto;

  @ApiPropertyOptional({ type: OpcionesCampanaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OpcionesCampanaDto)
  opciones?: OpcionesCampanaDto;
}

export class CrearCampanaDto extends VistaPreviaCampanaDto {
  @ApiProperty({ example: "BLACK FRIDAY" })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  nombre!: string;

  @ApiProperty({ example: "2026-11-16T04:00:00.000Z", description: "Inicio (ISO 8601, en UTC)." })
  @IsISO8601()
  inicio!: string;

  @ApiProperty({ example: "2026-12-01T03:59:00.000Z", description: "Fin (ISO 8601, en UTC)." })
  @IsISO8601()
  fin!: string;

  @ApiPropertyOptional({ description: "true = crearla ya programada (si el inicio ya pasó, se aplica al instante)." })
  @IsOptional()
  @IsBoolean()
  programar?: boolean;
}
