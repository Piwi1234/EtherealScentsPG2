import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, Min } from "class-validator";
import { TAMANOS_DECANT_ML } from "@app/shared";

export class CreatePresentacionVentaDto {
  @ApiProperty({ example: 10, enum: TAMANOS_DECANT_ML, description: "Cantidad en ml que representa esta presentación (uno de los tamaños fijos de decant)." })
  @IsInt()
  @IsIn([...TAMANOS_DECANT_ML], { message: `cantidadMl debe ser uno de los tamaños de decant: ${TAMANOS_DECANT_ML.join(", ")} ml.` })
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
