import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, Min } from "class-validator";

export class UpdateExchangeRateDto {
  @ApiProperty({ example: 36.5, description: "Bolívares por cada dólar." })
  @IsNumber()
  @Min(0)
  exchangeRate!: number;
}
