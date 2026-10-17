import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateHistoriaBloqueDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  texto1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  texto2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  texto3?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  texto4?: string;
}
