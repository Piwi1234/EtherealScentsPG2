import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUrl } from "class-validator";

export class UpdateCarouselImageUrlDto {
  @ApiPropertyOptional({
    description: "Link al que redirige la imagen en el sitio público al hacer click. Vacío/null la deja sin click.",
  })
  @IsOptional()
  // require_tld: false — si no, "http://localhost:3100/..." (útil para probar en desarrollo, o
  // cualquier host interno sin dominio público) queda rechazado por no tener un TLD como ".com".
  @IsUrl(
    { require_protocol: true, require_tld: false },
    { message: "url debe ser una URL válida (con http:// o https://)." },
  )
  url?: string | null;
}
