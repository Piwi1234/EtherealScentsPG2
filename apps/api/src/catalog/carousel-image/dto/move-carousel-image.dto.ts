import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class MoveCarouselImageDto {
  @ApiProperty({ enum: ["up", "down"], description: "Intercambia el orden con la imagen vecina en esa dirección." })
  @IsIn(["up", "down"])
  direction!: "up" | "down";
}
