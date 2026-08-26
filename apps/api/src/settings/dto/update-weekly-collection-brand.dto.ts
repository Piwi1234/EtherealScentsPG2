import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class UpdateWeeklyCollectionBrandDto {
  @ApiPropertyOptional({
    description: "Marca elegida para el bloque \"Colección de la semana\" del home. Null = ocultar el bloque.",
  })
  @IsOptional()
  @IsUUID()
  brandId?: string | null;
}
