import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdatePromoModalEnabledDto {
  @ApiProperty({ description: "Si el modal promocional se muestra en el sitio público." })
  @IsBoolean()
  enabled!: boolean;
}
