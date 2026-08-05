import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class TransitionProformaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;
}
