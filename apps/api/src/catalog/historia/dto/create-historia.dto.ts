import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { HistoriaCategoria } from "@app/database";
import { ArrayNotEmpty, ArrayUnique, IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class CreateHistoriaDto {
  @ApiProperty({ example: "El hombre detrás de las leyendas" })
  @IsString()
  @IsNotEmpty()
  titulo!: string;

  @ApiPropertyOptional({ example: "el-hombre-detras-de-las-leyendas", description: "Se genera desde el título si se omite." })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug debe ser kebab-case (ej: 'mi-historia')" })
  slug?: string;

  @ApiProperty({ enum: HistoriaCategoria, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(HistoriaCategoria, { each: true })
  categorias!: HistoriaCategoria[];
}
