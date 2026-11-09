import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from "class-validator";
import { LoteOrigenInputDto } from "./create-traspaso-almacen.dto";

export class ConvertirProbadorDto {
  @ApiProperty()
  @IsUUID()
  varianteId!: string;

  @ApiProperty()
  @IsUUID()
  almacenId!: string;

  @ApiProperty({ type: [LoteOrigenInputDto], description: "De qué lote(s) del almacén sale lo que se convierte en probador (reparto manual, como un traspaso)." })
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

export class ProbadorADecantDto {
  @ApiProperty({ description: "Variante del frasco (unidad PZA) cuyos probadores se vierten." })
  @IsUUID()
  varianteOrigenId!: string;

  @ApiProperty({ description: "Variante Decants (unidad ML) del mismo producto, que recibe los ml." })
  @IsUUID()
  varianteId!: string;

  @ApiProperty()
  @IsUUID()
  almacenId!: string;

  @ApiProperty({ example: 2, description: "Cuántos probadores se vierten." })
  @IsInt()
  @Min(1)
  cantidadProbadores!: number;

  @ApiProperty({ example: 100, description: "ml de fábrica del frasco: de ahí sale el costo por ml (costo del probador / ml)." })
  @IsInt()
  @Min(1)
  mlPorFrasco!: number;

  @ApiProperty({ example: 35, description: "ml que realmente se rescatan en total (suma de lo que quedaba en esos probadores)." })
  @IsInt()
  @Min(1)
  mlRescatados!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;
}

export class BajaProbadorDto {
  @ApiProperty()
  @IsUUID()
  varianteId!: string;

  @ApiProperty()
  @IsUUID()
  almacenId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  cantidad!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;
}
