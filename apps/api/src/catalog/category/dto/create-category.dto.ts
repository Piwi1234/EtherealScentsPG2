import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({ example: "Celulares" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: "celulares", description: "Se genera desde el nombre si se omite." })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug debe ser kebab-case (ej: 'accesorios-cocina')" })
  slug?: string;

  @ApiPropertyOptional({ description: "Id de la categoría padre, si es una subcategoría." })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
