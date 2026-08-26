import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCarouselImageTitulosDto {
  @ApiPropertyOptional({ description: "Subtítulo chico superpuesto arriba de la imagen. Vacío/null lo oculta." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  titulo1?: string | null;

  @ApiPropertyOptional({ description: "Título grande superpuesto sobre la imagen. Vacío/null lo oculta." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  titulo2?: string | null;
}
