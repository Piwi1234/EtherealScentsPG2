import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateAttributeOptionDto {
  @ApiProperty({ example: "128GB" })
  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class UpdateAttributeOptionDto extends CreateAttributeOptionDto {}
