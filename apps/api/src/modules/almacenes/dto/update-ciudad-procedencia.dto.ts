import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateCiudadProcedenciaDto } from "./create-ciudad-procedencia.dto";

export class UpdateCiudadProcedenciaDto extends PartialType(CreateCiudadProcedenciaDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
