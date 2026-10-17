import { ApiPropertyOptional } from "@nestjs/swagger";
import { HistoriaSugerenciaTipo } from "@app/database";
import { IsEnum, IsOptional, IsUUID } from "class-validator";

export class UpdateHistoriaSugerenciaDto {
  @ApiPropertyOptional({ enum: HistoriaSugerenciaTipo, description: "Null quita la sugerencia." })
  @IsOptional()
  @IsEnum(HistoriaSugerenciaTipo)
  tipo?: HistoriaSugerenciaTipo | null;

  @ApiPropertyOptional({ description: "Requerido cuando tipo = CASA." })
  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @ApiPropertyOptional({ description: "Requerido cuando tipo = INGREDIENTE (id de un AttributeOption de Acordes)." })
  @IsOptional()
  @IsUUID()
  attributeOptionId?: string | null;
}
