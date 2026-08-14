import { ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateCarteraDto } from "./create-cartera.dto";

/** moneda no se puede cambiar después de creada (cambiaría el sentido de todo su historial). */
export class UpdateCarteraDto extends PartialType(OmitType(CreateCarteraDto, ["moneda"] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
