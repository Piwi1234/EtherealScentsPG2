import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

export class AddDetalleVentaDto {
  @ApiProperty()
  @IsUUID()
  varianteId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  cantidad!: number;

  @ApiProperty({ description: "Almacén del que se intenta reservar stock al aprobar." })
  @IsUUID()
  almacenId!: string;

  @ApiPropertyOptional({ description: "Si se omite, nace de ProductVariant.precioFinalBs calculado en vivo." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioUnitario?: number;
}
