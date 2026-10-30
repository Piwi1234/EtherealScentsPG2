import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from "class-validator";
import { LoteOrigenInputDto } from "./create-traspaso-almacen.dto";

export class ConvertirDecantDto {
  @ApiProperty({ description: "Variante de frascos (unidad PZA) de la que salen los frascos." })
  @IsUUID()
  varianteOrigenId!: string;

  @ApiProperty({ description: "Variante Decants (unidad ML) del mismo producto, que recibe los ml." })
  @IsUUID()
  varianteId!: string;

  @ApiProperty()
  @IsUUID()
  almacenId!: string;

  @ApiProperty({ example: 100, description: "ml que trae cada frasco." })
  @IsInt()
  @Min(1)
  mlPorFrasco!: number;

  @ApiProperty({ type: [LoteOrigenInputDto], description: "De qué lote(s) de frascos sale lo que se convierte (cantidad = frascos)." })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LoteOrigenInputDto)
  lotes!: LoteOrigenInputDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;
}

export class BajaMlDto {
  @ApiProperty({ description: "Variante Decants (unidad ML)." })
  @IsUUID()
  varianteId!: string;

  @ApiProperty()
  @IsUUID()
  almacenId!: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  cantidadMl!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;
}
