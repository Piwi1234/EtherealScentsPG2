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
