import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreatePaisProcedenciaDto } from "./create-pais-procedencia.dto";

export class UpdatePaisProcedenciaDto extends PartialType(CreatePaisProcedenciaDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
