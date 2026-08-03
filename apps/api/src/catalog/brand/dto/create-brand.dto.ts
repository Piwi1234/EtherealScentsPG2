import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ArrayUnique, IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from "class-validator";

export class CreateBrandDto {
  @ApiProperty({ example: "Samsung" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: "samsung", description: "Se genera desde el nombre si se omite." })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug debe ser kebab-case (ej: 'mi-marca')" })
  slug?: string;

  @ApiPropertyOptional({ type: [String], description: "Categorías a las que se asigna la marca." })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  categoryIds?: string[];
}
