import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Min } from "class-validator";

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

  @ApiPropertyOptional({ description: "Solo válido en subcategorías: costo logístico heredado por sus productos." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  logisticsCost?: number;

  @ApiPropertyOptional({ description: "Solo válido en subcategorías: costo de envío heredado por sus productos." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  @ApiPropertyOptional({ description: "Solo válido en subcategorías: costo de seguridad heredado por sus productos." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  securityCost?: number;

  @ApiPropertyOptional({ description: "Solo válido en categorías raíz (sin padre): nota interna libre." })
  @IsOptional()
  @IsString()
  comentario?: string;

  @ApiPropertyOptional({
    description: "Solo válido en categorías raíz (sin padre): orden en que aparece su bloque en el Home (menor primero).",
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}
