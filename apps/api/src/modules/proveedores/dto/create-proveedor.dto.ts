import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateProveedorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @ApiProperty()
  @IsUUID()
  paisProcedenciaId!: string;

  @ApiPropertyOptional({ description: "Info libre sobre el proveedor." })
  @IsOptional()
  @IsString()
  nota?: string;
}
