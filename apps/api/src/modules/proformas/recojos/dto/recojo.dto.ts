import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from "class-validator";

export class RecojoLineaDto {
  @ApiProperty({ description: "Línea de la compra de la que se recogió." })
  @IsUUID()
  compraDetalleId!: string;

  @ApiProperty({ example: 3, description: "Unidades recogidas en este recojo (no puede pasar de lo que falta por recoger)." })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class CreateRecojoDto {
  @ApiPropertyOptional({ description: "Fecha del recojo; por defecto, ahora." })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiPropertyOptional({ description: "Ej. 'lo recogió Juan', 'el proveedor dejó el resto para la próxima semana'." })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;

  @ApiProperty({ type: [RecojoLineaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecojoLineaDto)
  lineas!: RecojoLineaDto[];
}
