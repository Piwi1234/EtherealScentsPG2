import { ApiPropertyOptional } from "@nestjs/swagger";
import { HistoriaCategoria } from "@app/database";
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsOptional, IsString, Matches } from "class-validator";

export class UpdateHistoriaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  titulo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug debe ser kebab-case (ej: 'mi-historia')" })
  slug?: string;

  @ApiPropertyOptional({ enum: HistoriaCategoria, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(HistoriaCategoria, { each: true })
  categorias?: HistoriaCategoria[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  publicada?: boolean;
}
