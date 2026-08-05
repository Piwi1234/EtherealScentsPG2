import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { EstadoSeguimiento } from "@app/database";

export class CreateSeguimientoDto {
  @ApiProperty({ enum: EstadoSeguimiento })
  @IsEnum(EstadoSeguimiento)
  estado!: EstadoSeguimiento;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;
}
