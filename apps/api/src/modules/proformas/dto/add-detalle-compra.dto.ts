import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNumber, IsUUID, Min } from "class-validator";

/** Los 4 costos son de ESTA línea/compra puntual, no heredados del catálogo. */
export class AddDetalleCompraDto {
  @ApiProperty()
  @IsUUID()
  varianteId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  cantidad!: number;

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
