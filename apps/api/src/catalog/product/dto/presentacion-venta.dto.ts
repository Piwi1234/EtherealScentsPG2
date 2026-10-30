import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from "class-validator";

export class CreatePresentacionVentaDto {
  @ApiProperty({ example: 10, description: "Cantidad en ml que representa esta presentación." })
  @IsInt()
  @Min(1)
  cantidadMl!: number;

  @ApiProperty({ example: 150, description: "Precio de venta en Bs de esta presentación (manual, no calculado)." })
  @IsNumber()
  @Min(0)
  precioVentaBs!: number;

  @ApiPropertyOptional({ example: 3, description: "Costo en Bs del empaque de UNA presentación (distinto por tamaño). Por defecto 0." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costoEmpaqueBs?: number;
}

// cantidadMl es inmutable después de creada (define la presentación) — solo precioVentaBs/activo se editan.
export class UpdatePresentacionVentaDto extends PartialType(OmitType(CreatePresentacionVentaDto, ["cantidadMl"] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
