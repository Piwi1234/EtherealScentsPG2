import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

/** Los 4 costos son de ESTA línea/compra puntual, no heredados del catálogo. proveedorId también es
 * por línea (una misma proforma, un mismo envío, puede traer productos de varios proveedores
 * distintos) pero se elige después, directo en la proforma ya creada (ver UpdateDetalleDto) — acá es
 * opcional para no interrumpir el flujo rápido de "agregar producto". */
export class AddDetalleCompraDto {
  @ApiProperty()
  @IsUUID()
  varianteId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  cantidad!: number;

  @ApiPropertyOptional({ description: "A quién se le compra esta línea puntual — se puede elegir después, desde la proforma." })
  @IsOptional()
  @IsUUID()
  proveedorId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  precioCompra!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  costoEnvio!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  costoSeguridad!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  costoLogistica!: number;
}
