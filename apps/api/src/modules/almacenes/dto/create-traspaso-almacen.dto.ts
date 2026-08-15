import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from "class-validator";

export class LoteOrigenInputDto {
  @ApiProperty({ description: "LoteCompra del almacén origen del que sale esta cantidad." })
  @IsUUID()
  loteCompraId!: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class CreateTraspasoAlmacenDto {
  @ApiProperty()
  @IsUUID()
  varianteId!: string;

  @ApiProperty()
  @IsUUID()
  almacenOrigenId!: string;

  @ApiProperty()
  @IsUUID()
  almacenDestinoId!: string;

  @ApiProperty({
    type: [LoteOrigenInputDto],
    description: "De qué lote(s) del almacén origen sale la cantidad total a traspasar — reparto manual, igual criterio que completar una venta.",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LoteOrigenInputDto)
  lotes!: LoteOrigenInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nota?: string;
}
