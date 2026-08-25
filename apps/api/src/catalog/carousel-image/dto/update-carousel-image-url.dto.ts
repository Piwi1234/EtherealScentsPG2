import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUrl } from "class-validator";

export class UpdateCarouselImageUrlDto {
  @ApiPropertyOptional({
    description: "Link al que redirige la imagen en el sitio público al hacer click. Vacío/null la deja sin click.",
  })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: "url debe ser una URL válida (con http:// o https://)." })
  url?: string | null;
}
