import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateAlmacenDto } from "./create-almacen.dto";

export class UpdateAlmacenDto extends PartialType(CreateAlmacenDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
