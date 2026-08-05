import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateEmpresaDto } from "./create-empresa.dto";

export class UpdateEmpresaDto extends PartialType(CreateEmpresaDto) {
  @ApiPropertyOptional({ description: "false reactivable vía PATCH; DELETE también lo pone en false." })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
